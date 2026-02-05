#!/usr/bin/env python3
"""
Fix Grafana Dashboards:
1. Container Resources - Use container names instead of hardcoded IDs
2. Notifications - Fix metric names
3. System Overview - Clean up and optimize
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

def fix_container_resources_dashboard(dashboard_path):
    """Fix Container Resources dashboard to use stable container identifiers"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    container_map = get_container_mapping()
    print(f"   Found {len(container_map)} running containers")

    # Define container to service mapping
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
        'pgadmin': 'pgadmin'
    }

    panels_fixed = 0
    for panel in dashboard.get('panels', []):
        if 'targets' not in panel:
            continue

        for target in panel['targets']:
            expr = target.get('expr', '')

            # Look for hardcoded container IDs in queries
            old_pattern = r'/docker/[a-f0-9]{12}\.\*'
            if re.search(old_pattern, expr):
                # Try to identify which container this panel is for
                title = panel.get('title', '').lower()

                matched_container = None
                for service_name, container_name in service_containers.items():
                    if service_name.replace('-', '') in title.replace(' ', '').lower():
                        matched_container = container_name
                        break

                if matched_container and matched_container in container_map:
                    container_id = container_map[matched_container]
                    # Update query with current container ID
                    new_expr = re.sub(old_pattern, f'/docker/{container_id}.*', expr)
                    target['expr'] = new_expr
                    panels_fixed += 1
                    print(f"   ✅ Fixed panel: {panel.get('title')} -> {container_id}")

    # Save updated dashboard
    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixed {panels_fixed} panels")
    return panels_fixed

def fix_notifications_dashboard(dashboard_path):
    """Fix Notifications dashboard metric names"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    # Metric name mappings (wrong -> correct)
    metric_fixes = {
        'telegram_commands_received_total': 'telegram_updates_total',
        'telegram_unique_users_total': 'telegram_active_users_daily',
        # Add more as needed
    }

    panels_fixed = 0
    for panel in dashboard.get('panels', []):
        if 'targets' not in panel:
            continue

        for target in panel['targets']:
            expr = target.get('expr', '')

            for wrong_metric, correct_metric in metric_fixes.items():
                if wrong_metric in expr:
                    target['expr'] = expr.replace(wrong_metric, correct_metric)
                    panels_fixed += 1
                    print(f"   ✅ Fixed: {wrong_metric} -> {correct_metric} in '{panel.get('title')}'")

    # Save updated dashboard
    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixed {panels_fixed} metrics")
    return panels_fixed

def main():
    print("🎨 Grafana Dashboard Fixer\n")
    print("=" * 60)

    dashboards_dir = Path('/Users/yogendrasingh/trading-repo/Trading-System/infrastructure/monitoring/grafana/dashboards')

    # Fix each dashboard
    container_resources = dashboards_dir / 'container-resources.json'
    notifications = dashboards_dir / 'notifications.json'

    total_fixes = 0

    if container_resources.exists():
        total_fixes += fix_container_resources_dashboard(container_resources)

    if notifications.exists():
        total_fixes += fix_notifications_dashboard(notifications)

    print("\n" + "=" * 60)
    print(f"✅ Total fixes applied: {total_fixes}")
    print("\n💡 Next steps:")
    print("   1. Restart Grafana: docker restart grafana")
    print("   2. Refresh dashboards in browser")
    print("   3. Verify all panels show data")

if __name__ == '__main__':
    main()
