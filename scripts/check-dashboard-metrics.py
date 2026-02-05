#!/usr/bin/env python3
"""
Check all dashboard panels and identify which ones have no data
"""

import json
import requests
import sys
from pathlib import Path
from urllib.parse import quote

PROMETHEUS_URL = "http://localhost:9090"

def check_metric(query):
    """Check if a Prometheus query returns data"""
    try:
        encoded_query = quote(query)
        response = requests.get(f"{PROMETHEUS_URL}/api/v1/query?query={encoded_query}", timeout=5)
        data = response.json()

        if data.get('status') == 'success':
            results = data.get('data', {}).get('result', [])
            return len(results) > 0, len(results)
        else:
            return False, 0
    except Exception as e:
        return False, 0

def analyze_dashboard(dashboard_path):
    """Analyze all panels in a dashboard"""
    print(f"\n{'='*80}")
    print(f"📊 Analyzing: {dashboard_path.name}")
    print(f"{'='*80}\n")

    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)

    panels = dashboard.get('panels', [])
    total_panels = 0
    panels_with_data = 0
    panels_without_data = []

    for panel in panels:
        title = panel.get('title', 'Untitled')
        panel_type = panel.get('type', 'unknown')

        # Skip rows and text panels
        if panel_type in ['row', 'text']:
            continue

        targets = panel.get('targets', [])
        if not targets:
            continue

        total_panels += 1
        has_data = False

        for target in targets:
            expr = target.get('expr', '')
            if not expr:
                continue

            data_found, series_count = check_metric(expr)
            if data_found:
                has_data = True
                panels_with_data += 1
                print(f"✅ {title:50s} | {series_count:3d} series | {expr[:60]}")
                break

        if not has_data:
            # Get the first query
            first_query = targets[0].get('expr', 'No query') if targets else 'No query'
            panels_without_data.append({
                'title': title,
                'type': panel_type,
                'query': first_query
            })
            print(f"❌ {title:50s} | NO DATA   | {first_query[:60]}")

    print(f"\n{'='*80}")
    print(f"Summary: {panels_with_data}/{total_panels} panels have data")
    print(f"{'='*80}\n")

    return panels_without_data

def main():
    print("🔍 Dashboard Metrics Checker\n")

    dashboards_dir = Path('/Users/yogendrasingh/trading-repo/Trading-System/infrastructure/monitoring/grafana/dashboards')

    all_issues = {}

    for dashboard_file in ['system-overview.json', 'notifications.json', 'container-resources.json']:
        dashboard_path = dashboards_dir / dashboard_file
        if dashboard_path.exists():
            issues = analyze_dashboard(dashboard_path)
            if issues:
                all_issues[dashboard_file] = issues

    # Print summary
    print("\n" + "="*80)
    print("📋 DETAILED ISSUES SUMMARY")
    print("="*80 + "\n")

    if all_issues:
        for dashboard_name, issues in all_issues.items():
            print(f"\n🔴 {dashboard_name} - {len(issues)} panels without data:\n")
            for issue in issues:
                print(f"   Panel: {issue['title']}")
                print(f"   Type:  {issue['type']}")
                print(f"   Query: {issue['query'][:100]}")
                print()
    else:
        print("✅ All panels have data!")

if __name__ == '__main__':
    main()
