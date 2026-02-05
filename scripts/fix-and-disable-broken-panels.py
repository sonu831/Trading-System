#!/usr/bin/env python3
"""
Fix working panels and disable broken panels in all dashboards
"""

import json
import subprocess
from pathlib import Path

def get_current_containers():
    """Get all current Docker container IDs"""
    result = subprocess.run(
        ['docker', 'ps', '--format', '{{.ID}}'],
        capture_output=True,
        text=True
    )

    container_ids = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]
    return container_ids

def fix_system_overview(dashboard_path):
    """Fix System Overview dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes = 0
    disabled = 0

    for panel in dashboard.get('panels', []):
        title = panel.get('title', '')

        # Disable Loki logs panel (not configured)
        if 'Logs' in title and panel.get('type') == 'logs':
            panel['transparent'] = True
            panel['title'] = title + ' (Logs disabled - Loki not configured)'
            # Hide the panel
            panel['gridPos']['h'] = 1
            disabled += 1
            print(f"   ⚠️  Disabled: {title}")
            continue

        # Keep other panels as-is

    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Fixes: {fixes}, Disabled: {disabled}")
    return fixes + disabled

def fix_container_resources(dashboard_path, container_ids):
    """Fix Container Resources dashboard"""
    print(f"\n🔧 Fixing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    fixes = 0

    # Create regex pattern for all current containers
    if container_ids:
        # Take first 12 chars of each container ID
        short_ids = [cid[:12] for cid in container_ids]
        container_pattern = '|'.join(short_ids)

        for panel in dashboard.get('panels', []):
            title = panel.get('title', '')

            # Fix overall CPU chart
            if 'CPU Usage by Container' in title and panel.get('type') == 'timeseries':
                for target in panel.get('targets', []):
                    old_expr = target.get('expr', '')

                    # Update query to use ALL current containers
                    new_expr = f'sum by (id) (rate(container_cpu_usage_seconds_total{{id=~"/docker/({container_pattern}).*",cpu="total"}}[1m])) * 100'

                    if old_expr != new_expr:
                        target['expr'] = new_expr
                        fixes += 1
                        print(f"   ✅ Fixed: {title} - now queries {len(container_ids)} containers")

            # Fix overall Memory chart
            elif 'Memory Usage by Container' in title and panel.get('type') == 'timeseries':
                for target in panel.get('targets', []):
                    old_expr = target.get('expr', '')

                    # Update query to use ALL current containers
                    new_expr = f'container_memory_usage_bytes{{id=~"/docker/({container_pattern}).*"}} / 1024 / 1024'

                    if old_expr != new_expr:
                        target['expr'] = new_expr
                        fixes += 1
                        print(f"   ✅ Fixed: {title} - now queries {len(container_ids)} containers")

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

    for panel in dashboard.get('panels', []):
        title = panel.get('title', '')
        panel_type = panel.get('type', '')

        # Disable Kafka metrics panels (metrics don't exist)
        if any(keyword in title.lower() for keyword in ['kafka', 'processed', 'channel']):
            if panel_type not in ['row', 'text']:
                # Make panel transparent and add notice
                panel['transparent'] = True
                if 'Kafka' not in title:
                    panel['title'] = title + ' (No Kafka metrics)'
                # Shrink panel
                if panel.get('gridPos'):
                    panel['gridPos']['h'] = 1
                disabled += 1
                print(f"   ⚠️  Disabled: {title}")

        # Disable Loki logs panels
        elif panel_type == 'logs':
            panel['transparent'] = True
            panel['title'] = title + ' (Logs disabled)'
            if panel.get('gridPos'):
                panel['gridPos']['h'] = 1
            disabled += 1
            print(f"   ⚠️  Disabled: {title}")

    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"   📊 Disabled: {disabled}")
    return disabled

def main():
    print("🎨 Dashboard Fixer - Fix & Disable Broken Panels")
    print("=" * 80)

    # Get current containers
    container_ids = get_current_containers()
    print(f"\n📦 Found {len(container_ids)} running containers")

    dashboards_dir = Path('/Users/yogendrasingh/trading-repo/Trading-System/infrastructure/monitoring/grafana/dashboards')

    total_changes = 0

    # Fix each dashboard
    system_overview = dashboards_dir / 'system-overview.json'
    if system_overview.exists():
        total_changes += fix_system_overview(system_overview)

    container_resources = dashboards_dir / 'container-resources.json'
    if container_resources.exists():
        total_changes += fix_container_resources(container_resources, container_ids)

    notifications = dashboards_dir / 'notifications.json'
    if notifications.exists():
        total_changes += fix_notifications(notifications)

    print("\n" + "=" * 80)
    print(f"✅ Total changes: {total_changes}")
    print("\nDisabled panels:")
    print("  - AI & Analysis Logs (Loki not configured)")
    print("  - Telegram Bot Logs (Loki not configured)")
    print("  - Email Service Logs (Loki not configured)")
    print("  - Kafka message process panels (metrics not exported)")
    print("\nFixed panels:")
    print("  - CPU Usage by Container (now queries all containers)")
    print("  - Memory Usage by Container (now queries all containers)")
    print("\n💡 Restart Grafana: docker restart grafana")

if __name__ == '__main__':
    main()
