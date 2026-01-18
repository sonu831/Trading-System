// Package sectors provides sector mapping and grouping for Nifty 50 stocks
package sectors

// SectorMap maps stocks to their sectors
var SectorMap = map[string]string{
	// Banking & Financial Services
	"HDFCBANK":   "Banking",
	"ICICIBANK":  "Banking",
	"SBIN":       "Banking",
	"KOTAKBANK":  "Banking",
	"AXISBANK":   "Banking",
	"INDUSINDBK": "Banking",
	"BAJFINANCE": "Financial Services",
	"BAJAJFINSV": "Financial Services",
	"HDFCLIFE":   "Financial Services",
	"SBILIFE":    "Financial Services",

	// IT & Technology
	"TCS":     "IT",
	"INFY":    "IT",
	"HCLTECH": "IT",
	"WIPRO":   "IT",
	"TECHM":   "IT",
	"LTIM":    "IT",

	// Oil & Gas / Energy
	"RELIANCE":  "Energy",
	"ONGC":      "Energy",
	"BPCL":      "Energy",
	"NTPC":      "Power",
	"POWERGRID": "Power",
	"COALINDIA": "Mining",

	// Automobile
	"TATAMOTORS": "Automobile",
	"MARUTI":     "Automobile",
	"M&M":        "Automobile",
	"BAJAJ-AUTO": "Automobile",
	"HEROMOTOCO": "Automobile",
	"EICHERMOT":  "Automobile",

	// FMCG & Consumer
	"HINDUNILVR": "FMCG",
	"ITC":        "FMCG",
	"NESTLEIND":  "FMCG",
	"BRITANNIA":  "FMCG",
	"TATACONSUM": "FMCG",
	"TITAN":      "Consumer",

	// Metals & Materials
	"TATASTEEL":  "Metals",
	"JSWSTEEL":   "Metals",
	"HINDALCO":   "Metals",
	"ULTRACEMCO": "Cement",
	"GRASIM":     "Cement",

	// Pharma & Healthcare
	"SUNPHARMA":  "Pharma",
	"DRREDDY":    "Pharma",
	"CIPLA":      "Pharma",
	"DIVISLAB":   "Pharma",
	"APOLLOHOSP": "Healthcare",

	// Telecom & Infrastructure
	"BHARTIARTL": "Telecom",
	"LT":         "Infrastructure",
	"ADANIPORTS": "Infrastructure",
	"ADANIENT":   "Conglomerate",

	// Others
	"ASIANPAINT": "Paints",
	"SHRIRAMFIN": "Financial Services",
}

// AllSectors returns list of unique sectors
func AllSectors() []string {
	sectorSet := make(map[string]bool)
	for _, sector := range SectorMap {
		sectorSet[sector] = true
	}

	sectors := make([]string, 0, len(sectorSet))
	for sector := range sectorSet {
		sectors = append(sectors, sector)
	}
	return sectors
}

// GetSector returns the sector for a given symbol
func GetSector(symbol string) string {
	if sector, ok := SectorMap[symbol]; ok {
		return sector
	}
	return "Other"
}

// GroupBySecctor groups stocks by their sector
func GroupBySector(symbols []string) map[string][]string {
	result := make(map[string][]string)
	for _, symbol := range symbols {
		sector := GetSector(symbol)
		result[sector] = append(result[sector], symbol)
	}
	return result
}
