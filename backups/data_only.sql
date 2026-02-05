-- Data extracted from backup (TimescaleDB version-agnostic)
-- Only public schema tables, no internal TimescaleDB structures

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;

COPY public.sectors (id, name, display_name, description, weight, created_at) FROM stdin;
1	IT	Information Technology	\N	\N	2026-01-29 08:53:42.483127+00
2	BANKING	Banking & Financial Services	\N	\N	2026-01-29 08:53:42.483127+00
3	AUTO	Automobile	\N	\N	2026-01-29 08:53:42.483127+00
4	PHARMA	Pharmaceuticals	\N	\N	2026-01-29 08:53:42.483127+00
5	FMCG	Fast Moving Consumer Goods	\N	\N	2026-01-29 08:53:42.483127+00
6	ENERGY	Oil & Gas	\N	\N	2026-01-29 08:53:42.483127+00
7	METALS	Metals & Mining	\N	\N	2026-01-29 08:53:42.483127+00
8	REALTY	Real Estate	\N	\N	2026-01-29 08:53:42.483127+00
9	TELECOM	Telecommunications	\N	\N	2026-01-29 08:53:42.483127+00
10	INFRA	Infrastructure	\N	\N	2026-01-29 08:53:42.483127+00
\.

COPY public.plans (id, name, display_name, description, price_monthly, price_yearly, currency, features, is_active, created_at) FROM stdin;
1	free	Free Tier	\N	0.00	0.00	INR	{"api_access": false, "max_alerts": 3, "max_watchlists": 1}	t	2026-01-29 08:53:42.550798+00
2	basic	Basic	\N	299.00	0.00	INR	{"api_access": false, "max_alerts": 10, "max_watchlists": 5}	t	2026-01-29 08:53:42.550798+00
3	premium	Premium	\N	999.00	0.00	INR	{"api_access": true, "max_alerts": 50, "max_watchlists": 20}	t	2026-01-29 08:53:42.550798+00
4	enterprise	Enterprise	\N	4999.00	0.00	INR	{"api_access": true, "max_alerts": -1, "max_watchlists": -1}	t	2026-01-29 08:53:42.550798+00
\.

COPY public.system_config (key, value, description, updated_at, updated_by) FROM stdin;
data_retention_days	{"ticks": 30, "candles_1d": 3650, "candles_1m": 365}	Data retention by timeframe	2026-01-29 08:53:42.539385+00	\N
compression_delay_hours	{"ticks": 24, "candles_1m": 168}	Hours before compression	2026-01-29 08:53:42.539385+00	\N
nifty50_last_updated	"2026-01-21"	Last Nifty 50 constituent update	2026-01-29 08:53:42.539385+00	\N
\.

COPY public.trading_calendar (date, is_trading_day, holiday_name, market_open, market_close, is_special, notes) FROM stdin;
\.

COPY public.instruments (id, symbol, name, isin, exchange, sector_id, industry, lot_size, tick_size, token, is_nifty50, is_active, listed_date, face_value, market_cap, created_at, updated_at) FROM stdin;
\.

COPY public.user_subscribers (id, chat_id, username, email, subscribed_at, is_active, user_id, is_verified, verification_token, preferences) FROM stdin;
1	718322381	sonu831	Er.yogendra.17@gmail.com	2026-01-18 20:00:17.981341+00	t	\N	f	\N	{}
\.

COPY public.api_keys (id, key, user_id, vendor_name, is_active, rate_limit, created_at) FROM stdin;
1	valid_sk_123	1	Test Vendor	t	10	2026-01-21 17:39:50.230246+00
\.

