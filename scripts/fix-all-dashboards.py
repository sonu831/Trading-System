#!/usr/bin/env python3
"""
Comprehensive dashboard fixer - fixes all metric queries and container IDs
"""

import json
import subprocess
import re
from pathlib import Path

def get_container_mapping():
    """Get current Docker container name to ID mapping"""
    result = subprocess.run(
        ['docker', 'ps', '--format', '{{.Names}}\t{{.ID}}'],
        capture_output=True,
        text=True
    )

    mapping = {}
    for line in result.stdout.strip().split('\n'):
        if '\t' in line:
            name, container_id = line.split('\t')
            mapping[name] = container_id

    return mapping

def fix_system_overview(dashboard_path, container_map):
    """Fix System Overview dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes_applied = 0

    # Metric name fixes
    metric_replacements = {
        'ingestion_ticks_total': 'ingestion_ticks_per_second',
        'telegram_updates_received_total': 'telegram_updates_total',
        'telegram_unique_users_today': 'telegram_active_users_daily',
    }

    for panel in dashboard.get('panels', []):
        if 'targets' not in panel:
            continue

        title = panel.get('title', '')

        for target in panel['targets']:
            expr = target.get('expr', '')
            old_expr = expr

            # Fix metric names
            for old_metric, new_metric in metric_replacements.items():
                if old_metric in expr:
                    expr = expr.replace(old_metric, new_metric)
                    fixes_applied += 1
                    print(f"   ✅ Fixed metric: {old_metric} → {new_metric}")

            # Fix AI container queries - use container ID instead of name
            if 'ai-inference' in container_map:
                ai_container_id = container_map['ai-inference']
                if "name='ai-inference'" in expr or 'name="ai-inference"' in expr:
                    expr = re.sub(
                        r"name=['\"]ai-inference['\"]",
                        f'id=~"/docker/{ai_container_id}.*"',
                        expr
                    )
                    fixes_applied += 1
                    print(f"   ✅ Fixed AI container query in '{title}'")

            # Fix logs query for Loki
            if 'container=' in expr and panel.get('type') == 'logs':
                # Loki uses different label syntax
                if '|=' not in expr:
                    expr = f"{expr} |= \"\""
                fixes_applied += 1
                print(f"   ✅ Fixed logs query in '{title}'")
            elif 'container_name=' in expr and panel.get('type') == 'logs':
                # Map container_name to container
                expr = expr.replace('container_name=', 'container=')
                if '|=' not in expr:
                    expr = f"{expr} |= \"\""
                fixes_applied += 1
                print(f"   ✅ Fixed logs query (container_name -> container) in '{title}'")

            if expr != old_expr:
                target['expr'] = expr

    # Save updated dashboard
    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Applied {fixes_applied} fixes")
    return fixes_applied

def fix_notifications(dashboard_path):
    """Fix Notifications dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes_applied = 0

    # Metric name fixes
    metric_replacements = {
        'telegram_unique_users_today': 'telegram_active_users_daily',
        'telegram_updates_received_total': 'telegram_updates_total',
    }

    for panel in dashboard.get('panels', []):
        if 'targets' not in panel:
            continue

        for target in panel['targets']:
            expr = target.get('expr', '')
            old_expr = expr

            # Fix metric names
            for old_metric, new_metric in metric_replacements.items():
                if old_metric in expr:
                    expr = expr.replace(old_metric, new_metric)
                    fixes_applied += 1

            # Remove status label filter from telegram_messages_sent_total (it doesn't have status label)
            if 'telegram_messages_sent_total{status=' in expr:
                expr = expr.replace('{status="success"}', '')
                fixes_applied += 1
                print(f"   ✅ Removed invalid status label from telegram_messages_sent_total")

            # Fix logs queries
            if panel.get('type') == 'logs' and ('container=' in expr or 'container_name=' in expr):
                if 'container_name=' in expr:
                    expr = expr.replace('container_name=', 'container=')
                    fixes_applied += 1
                if '|=' not in expr:
                    expr = re.sub(r'(\{[^}]+\})', r'\1 |= ""', expr)
                    fixes_applied += 1

            if expr != old_expr:
                target['expr'] = expr

    # Save updated dashboard
    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Applied {fixes_applied} fixes")
    return fixes_applied

def fix_container_resources(dashboard_path, container_map):
    """Fix Container Resources dashboard with proper CPU queries"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes_applied = 0

    # Update container IDs
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
        if 'targets' not in panel:
            continue

        title = panel.get('title', '').lower()

        for target in panel['targets']:
            expr = target.get('expr', '')
            old_expr = expr

            # Find hardcoded container IDs
            old_pattern = r'/docker/([a-f0-9]{12})\.\*'
            matches = re.findall(old_pattern, expr)

            if matches:
                # Try to identify which container this panel is for
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

                    if expr != old_expr:
                        fixes_applied += 1
                        print(f"   ✅ Updated {panel.get('title')}: {matches[0][:12]} → {new_id}")

            # Fix CPU query structure - use cpu="total" filter
            if 'container_cpu_usage_seconds_total' in expr and 'rate(' in expr:
                if 'cpu="total"' not in expr:
                    expr = re.sub(
                        r'container_cpu_usage_seconds_total\{([^}]*)\}',
                        r'container_cpu_usage_seconds_total{\1,cpu="total"}',
                        expr
                    )
                    # Clean up double commas
                    expr = expr.replace('{,', '{')
                    if expr != old_expr:
                        fixes_applied += 1
                        print(f"   ✅ Added cpu='total' filter to {panel.get('title')}")

            if expr != old_expr:
                target['expr'] = expr

    # Save updated dashboard
    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Applied {fixes_applied} fixes")
    return fixes_applied

def main():
    print("🎨 Comprehensive Dashboard Fixer\n")
    print("=" * 80)

    container_map = get_container_mapping()
    print(f"Found {len(container_map)} running containers\n")

    dashboards_dir = Path('/Users/yogendrasingh/trading-repo/Trading-System/infrastructure/monitoring/grafana/dashboards')

    total_fixes = 0

    # Fix each dashboard
    system_overview = dashboards_dir / 'system-overview.json'
    if system_overview.exists():
        total_fixes += fix_system_overview(system_overview, container_map)

    notifications = dashboards_dir / 'notifications.json'
    if notifications.exists():
        total_fixes += fix_notifications(notifications)

    container_resources = dashboards_dir / 'container-resources.json'
    if container_resources.exists():
        total_fixes += fix_container_resources(container_resources, container_map)

    print("\n" + "=" * 80)
    print(f"✅ Total fixes applied: {total_fixes}")
    print("\n💡 Next: Restart Grafana with 'docker restart grafana'")

if __name__ == '__main__':
    main()
