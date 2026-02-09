// Package sectors provides sector mapping and grouping for Nifty 50 stocks
// Loads data from shared/stocks/nifty50_shared.json (single source of truth)
package sectors

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"sync"
)

// StockEntry represents a stock from the shared JSON
type StockEntry struct {
	Symbol   string            `json:"symbol"`
	Exchange string            `json:"exchange"`
	Sector   string            `json:"sector"`
	Tokens   map[string]string `json:"tokens"`
}

// SectorMap maps stocks to their sectors - loaded from shared JSON
var (
	SectorMap     map[string]string
	loadOnce      sync.Once
	fallbackMap   = map[string]string{
		"HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking",
		"KOTAKBANK": "Banking", "AXISBANK": "Banking", "INDUSINDBK": "Banking",
		"BAJFINANCE": "Finance", "BAJAJFINSV": "Finance", "HDFCLIFE": "Insurance",
		"SBILIFE": "Insurance", "TCS": "IT", "INFY": "IT", "HCLTECH": "IT",
		"WIPRO": "IT", "TECHM": "IT", "LTIM": "IT", "RELIANCE": "Energy",
		"ONGC": "Energy", "BPCL": "Energy", "NTPC": "Power", "POWERGRID": "Power",
		"COALINDIA": "Mining", "TATAMOTORS": "Auto", "MARUTI": "Auto", "M&M": "Auto",
		"BAJAJ-AUTO": "Auto", "HEROMOTOCO": "Auto", "EICHERMOT": "Auto",
		"HINDUNILVR": "FMCG", "ITC": "FMCG", "NESTLEIND": "FMCG",
		"BRITANNIA": "FMCG", "TATACONSUM": "FMCG", "TITAN": "Consumer",
		"TATASTEEL": "Metal", "JSWSTEEL": "Metal", "HINDALCO": "Metal",
		"ULTRACEMCO": "Cement", "GRASIM": "Cement", "SUNPHARMA": "Pharma",
		"DRREDDY": "Pharma", "CIPLA": "Pharma", "DIVISLAB": "Pharma",
		"APOLLOHOSP": "Healthcare", "BHARTIARTL": "Telecom", "LT": "Infrastructure",
		"ADANIPORTS": "Infrastructure", "ADANIENT": "Infrastructure",
		"ASIANPAINT": "Consumer", "SHRIRAMFIN": "Finance",
	}
)

func init() {
	loadOnce.Do(loadSectorMap)
}

// loadSectorMap loads sectors from the shared JSON file
func loadSectorMap() {
	paths := []string{
		"/app/shared/stocks/nifty50_shared.json",     // Docker path
		"../../shared/stocks/nifty50_shared.json",    // Local dev path
		"../../../shared/stocks/nifty50_shared.json", // Alternative local path
	}

	var data []byte
	var err error
	for _, path := range paths {
		data, err = ioutil.ReadFile(path)
		if err == nil {
			break
		}
	}

	if err != nil {
		log.Printf("⚠️ Failed to load sectors from JSON, using fallback: %v", err)
		SectorMap = fallbackMap
		return
	}

	var stocks []StockEntry
	if err := json.Unmarshal(data, &stocks); err != nil {
		log.Printf("⚠️ Failed to parse sectors JSON, using fallback: %v", err)
		SectorMap = fallbackMap
		return
	}

	SectorMap = make(map[string]string, len(stocks))
	for _, s := range stocks {
		SectorMap[s.Symbol] = s.Sector
	}
	log.Printf("✅ Loaded %d sector mappings from shared JSON", len(SectorMap))
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

// GroupBySector groups stocks by their sector
func GroupBySector(symbols []string) map[string][]string {
	result := make(map[string][]string)
	for _, symbol := range symbols {
		sector := GetSector(symbol)
		result[sector] = append(result[sector], symbol)
	}
	return result
}
