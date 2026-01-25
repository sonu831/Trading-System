#!/usr/bin/env python3
"""
Complete Grafana Dashboard Fixer
- Fixes all working panels with correct queries
- Disables panels that can't work (Loki logs, missing metrics)
- Updates container IDs to current running containers
"""

import json
import subprocess
import re
from pathlib import Path

def get_container_mapping():
    """Get Docker container name to ID mapping"""
    result = subprocess.run(
        ['docker', 'ps', '--format', '{{.Names}}\t{{.ID}}'],
        capture_output=True,
        text=True
    )

    mapping = {}
    all_ids = []
    for line in result.stdout.strip().split('\n'):
        if '\t' in line:
            name, container_id = line.split('\t')
            mapping[name] = container_id
            all_ids.append(container_id[:12])  # First 12 chars

    return mapping, all_ids

def inject_ai_token_panels(dashboard):
    """Inject new AI Token Tracking panels if missing"""
    panels = dashboard.get('panels', [])
    titles = [p.get('title', '') for p in panels]
    
    if "AI Token Usage Rate" in titles:
        return 0

    print("   ➕ Injecting AI Token panels...")
    
    # Find Y position after the last panel
    max_y = 0
    for p in panels:
        grid = p.get('gridPos', {})
        y = grid.get('y', 0)
        h = grid.get('h', 0)
        max_y = max(max_y, y + h)

    start_y = max_y + 1

    new_panels = [
        {
            "gridPos": {"h": 1, "w": 24, "x": 0, "y": start_y},
            "id": 1000,
            "title": "AI Token Analytics & Performance",
            "type": "row",
            "collapsed": False,
            "panels": []
        },
        {
            "datasource": {"uid": "prometheus-datasource"},
            "gridPos": {"h": 8, "w": 8, "x": 0, "y": start_y + 1},
            "id": 1001,
            "title": "AI Token Usage Rate (Tokens/sec)",
            "type": "timeseries",
            "targets": [
                {"expr": "rate(ai_token_usage_total{type='input'}[1m])", "legendFormat": "{{model}} (Input)"},
                {"expr": "rate(ai_token_usage_total{type='output'}[1m])", "legendFormat": "{{model}} (Output)"}
            ]
        },
        {
            "datasource": {"uid": "prometheus-datasource"},
            "gridPos": {"h": 8, "w": 8, "x": 8, "y": start_y + 1},
            "id": 1002,
            "title": "Total Tokens Processed",
            "type": "stat",
            "targets": [
                {"expr": "sum by (type) (increase(ai_token_usage_total[1h]))", "legendFormat": "{{type}}"}
            ]
        },
        {
            "datasource": {"uid": "prometheus-datasource"},
            "gridPos": {"h": 8, "w": 8, "x": 16, "y": start_y + 1},
            "id": 1003,
            "title": "Inference Latency (p95)",
            "type": "timeseries",
            "targets": [
                {"expr": "histogram_quantile(0.95, sum(rate(ai_request_duration_seconds_bucket[5m])) by (le, model))", "legendFormat": "{{model}}"}
            ],
            "fieldConfig": {"defaults": {"unit": "s"}}
        },
        {
             "datasource": {"type": "loki", "uid": "loki-datasource"},
             "gridPos": {"h": 10, "w": 24, "x": 0, "y": start_y + 9},
             "id": 1004,
             "title": "AI Detailed Logs (Prompts & Responses)",
             "type": "logs",
             "targets": [{"expr": "{container=\"ai-inference\"} |= \"ai_inference\""}],
             "options": {"showTime": True, "wrapLogMessage": True}
        }
    ]
    
    dashboard['panels'].extend(new_panels)
    return len(new_panels)

def fix_system_overview(dashboard_path, container_map):
    """Fix System Overview dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes = 0
    disabled = 0

    metric_fixes = {
        'ingestion_ticks_total': 'ingestion_ticks_per_second',
        'telegram_updates_received_total': 'telegram_updates_total',
        'telegram_unique_users_today': 'telegram_active_users_daily',
    }

    # Remove redundant AI panels (moved to ai-analytics)
    panels_to_remove = [
        "AI Token Analytics & Performance",
        "AI Token Usage Rate (Tokens/sec)",
        "Total Tokens Processed",
        "Inference Latency (p95)",
        "AI Detailed Logs (Prompts & Responses)",
        "Layer 9: AI Service (Metrics & Logs)",
        "AI Stack CPU Usage",
        "AI Stack Memory Usage",
        "AI & Analysis Logs"
    ]
    
    # Filter out the AI panels
    original_count = len(dashboard.get('panels', []))
    dashboard['panels'] = [
        p for p in dashboard.get('panels', []) 
        if p.get('title') not in panels_to_remove
    ]
    removed_count = original_count - len(dashboard['panels'])
    if removed_count > 0:
        print(f"   🗑️ Removed {removed_count} redundant AI panels")

    for panel in dashboard.get('panels', []):
        title = panel.get('title', '')
        panel_type = panel.get('type', '')

        # Fix Loki logs panels
        if panel_type == 'logs':
            panel['transparent'] = True
            # Remove "disabled" from title if present
            panel['title'] = title.split(' (Logs')[0]
            if panel.get('gridPos') and panel['gridPos']['h'] < 3:
                panel['gridPos']['h'] = 8
            
            # Fix log queries
            for target in panel.get('targets', []):
                expr = target.get('expr', '')
                # Map container_name to container for Loki consistency
                if 'container_name=' in expr:
                    expr = expr.replace('container_name=', 'container=')
                if 'container=' in expr and '|=' not in expr:
                    expr = f"{expr} |= \"\""
                target['expr'] = expr
            fixes += 1
            continue

        # Fix metrics
        for target in panel.get('targets', []):
            expr = target.get('expr', '')
            old_expr = expr

            # Fix metric names
            for old_metric, new_metric in metric_fixes.items():
                if old_metric in expr:
                    expr = expr.replace(old_metric, new_metric)
                    fixes += 1

            # Fix AI container queries - use dynamic container label from cadvisor
            if 'container_cpu_usage_seconds_total' in expr or 'container_memory_usage_bytes' in expr:
                # Replace hardcoded ID with dynamic container label
                if 'id=~"/docker/' in expr:
                    expr = re.sub(
                        r'id=~"/docker/[a-f0-9]{12}\.\*"',
                        'container="ai-inference"',
                        expr
                    )
                    fixes += 1
                elif "name='ai-inference'" in expr or 'name="ai-inference"' in expr:
                    expr = re.sub(
                        r"name=['\"]ai-inference['\"]",
                        'container="ai-inference"',
                        expr
                    )
                    fixes += 1
                elif "name='ollama'" in expr or 'name="ollama"' in expr:
                     expr = re.sub(
                        r"name=['\"]ollama['\"]",
                        'container="ollama"',
                        expr
                    )
                     fixes += 1

            if expr != old_expr:
                target['expr'] = expr

    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixes: {fixes}, Disabled: {disabled}")
    return fixes + disabled

def fix_container_resources(dashboard_path, container_map, all_container_ids):
    """Fix Container Resources dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes = 0

    # Create pattern for all containers
    container_pattern = '|'.join(all_container_ids)

    service_containers = {
        'ingestion': 'ingestion',
        'processing': 'processing',
        'analysis': 'analysis',
        'aggregation': 'aggregation',
        'signal': 'signal',
        'backend-api': 'backend-api',
        'dashboard': 'dashboard',
        'telegram-bot': 'telegram-bot',
        'kafka': 'kafka',
        'redis': 'redis',
        'timescaledb': 'timescaledb',
        'prometheus': 'prometheus',
        'grafana': 'grafana',
        'loki': 'loki',
        'pgadmin': 'pgadmin',
        'ai-inference': 'ai-inference',
    }

    for panel in dashboard.get('panels', []):
        title = panel.get('title', '').lower()

        for target in panel.get('targets', []):
            expr = target.get('expr', '')
            old_expr = expr

            # Fix overall CPU/Memory charts
            if ('cpu usage by container' in title or 'memory usage by container' in title) and \
               panel.get('type') == 'timeseries':

                if 'container_cpu_usage_seconds_total' in expr:
                    expr = f'sum by (id) (rate(container_cpu_usage_seconds_total{{id=~"/docker/({container_pattern}).*",cpu="total"}}[1m])) * 100'
                    fixes += 1

                elif 'container_memory_usage_bytes' in expr:
                    expr = f'container_memory_usage_bytes{{id=~"/docker/({container_pattern}).*"}} / 1024 / 1024'
                    fixes += 1

            # Fix individual service panels
            else:
                # Update hardcoded container IDs
                old_pattern = r'/docker/([a-f0-9]{12})\.\*'
                if re.search(old_pattern, expr):
                    matched_container = None

                    for service_name, container_name in service_containers.items():
                        service_key = service_name.replace('-', '').lower()
                        title_key = title.replace(' ', '').replace('-', '').lower()

                        if service_key in title_key:
                            matched_container = container_name
                            break

                    if matched_container and matched_container in container_map:
                        new_id = container_map[matched_container]
                        expr = re.sub(old_pattern, f'/docker/{new_id}.*', expr)
                        fixes += 1

                # Add cpu="total" filter if missing
                if 'container_cpu_usage_seconds_total' in expr and 'cpu="total"' not in expr:
                    expr = re.sub(
                        r'container_cpu_usage_seconds_total\{([^}]*)\}',
                        r'container_cpu_usage_seconds_total{\1,cpu="total"}',
                        expr
                    )
                    expr = expr.replace('{,', '{')
                    fixes += 1

            if expr != old_expr:
                target['expr'] = expr

    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixes: {fixes}")
    return fixes

def fix_notifications(dashboard_path):
    """Fix Notifications dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes = 0
    disabled = 0

    metric_fixes = {
        'telegram_unique_users_today': 'telegram_active_users_daily',
        'telegram_updates_received_total': 'telegram_updates_total',
    }

    for panel in dashboard.get('panels', []):
        title = panel.get('title', '')
        panel_type = panel.get('type', '')

        # Disable Kafka panels (metrics don't exist)
        if any(kw in title.lower() for kw in ['kafka', 'processed', 'channel']) and \
           panel_type not in ['row', 'text']:
            panel['transparent'] = True
            if '(No Kafka metrics)' not in title:
                panel['title'] = title + ' (No Kafka metrics)'
            if panel.get('gridPos'):
                panel['gridPos']['h'] = 1
            disabled += 1
            continue

        # Fix log panels
        if panel_type == 'logs':
            panel['transparent'] = True
            panel['title'] = title.split(' (Logs')[0]
            if panel.get('gridPos') and panel['gridPos']['h'] < 3:
                panel['gridPos']['h'] = 8
            
            for target in panel.get('targets', []):
                expr = target.get('expr', '')
                if 'container_name=' in expr:
                    expr = expr.replace('container_name=', 'container=')
                if 'container=' in expr and '|=' not in expr:
                    expr = f"{expr} |= \"\""
                target['expr'] = expr
            fixes += 1
            continue

        # Fix metrics
        for target in panel.get('targets', []):
            expr = target.get('expr', '')
            old_expr = expr

            for old_metric, new_metric in metric_fixes.items():
                if old_metric in expr:
                    expr = expr.replace(old_metric, new_metric)
                    fixes += 1

            # Remove invalid status label
            if 'telegram_messages_sent_total{status=' in expr:
                expr = expr.replace('{status="success"}', '')
                fixes += 1

            if expr != old_expr:
                target['expr'] = expr

    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixes: {fixes}, Disabled: {disabled}")
    return fixes + disabled

def fix_ai_analytics(dashboard_path, container_map):
    """Fix AI Analytics dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes = 0

    # Fix container-specific panels
    for panel in dashboard.get('panels', []):
        for target in panel.get('targets', []):
            expr = target.get('expr', '')
            old_expr = expr

            # Fix AI/Ollama container queries for CPU/Mem
            if 'container_cpu_usage_seconds_total' in expr or 'container_memory_usage_bytes' in expr:
                 if 'id=~"/docker/' in expr:
                     if 'ai-inference' in container_map:
                         expr = re.sub(r'id=~"/docker/[a-f0-9]{12}\.\*"', f'id=~"/docker/{container_map["ai-inference"]}.*"', expr)
                         fixes += 1
                     elif 'ollama' in container_map:
                         expr = re.sub(r'id=~"/docker/[a-f0-9]{12}\.\*"', f'id=~"/docker/{container_map["ollama"]}.*"', expr)
                         fixes += 1
            
            # Ensure dynamic container label is used if preferred
            if 'container=' in expr:
                pass

            if expr != old_expr:
                target['expr'] = expr

    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixes: {fixes}")
    return fixes

def main():
    print("🎨 Complete Grafana Dashboard Fixer")
    print("=" * 80)

    container_map, all_ids = get_container_mapping()
    print(f"\n📦 Found {len(container_map)} containers ({len(all_ids)} IDs)\n")

    dashboards_dir = Path('/Users/yogendrasingh/trading-repo/Trading-System/infrastructure/monitoring/grafana/dashboards')

    total = 0

    system_overview = dashboards_dir / 'system-overview.json'
    if system_overview.exists():
        total += fix_system_overview(system_overview, container_map)

    container_resources = dashboards_dir / 'container-resources.json'
    if container_resources.exists():
        total += fix_container_resources(container_resources, container_map, all_ids)

    notifications = dashboards_dir / 'notifications.json'
    if notifications.exists():
        total += fix_notifications(notifications)

    ai_analytics = dashboards_dir / 'ai-analytics.json'
    if ai_analytics.exists():
        total += fix_ai_analytics(ai_analytics, container_map)

    print("\n" + "=" * 80)
    print(f"✅ Total changes: {total}")
    print("\n💡 Run: docker restart grafana")

if __name__ == '__main__':
    main()
