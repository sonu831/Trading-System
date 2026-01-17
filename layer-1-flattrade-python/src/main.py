import os
import time
import json
import logging
import threading
from dotenv import load_dotenv
from kafka import KafkaProducer
from api_helper import NorenApiPy

# Load env vars
load_dotenv()

# Logger setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("FlatTradePython")

# Config
USER_ID = os.getenv("FLATTRADE_USER_ID")
PASSWORD = os.getenv("FLATTRADE_PASSWORD")
API_KEY = os.getenv("FLATTRADE_API_KEY")
API_SECRET = os.getenv("FLATTRADE_API_SECRET", "dummy_secret") # Some libs need this
ACT_ID = os.getenv("FLATTRADE_ACTID")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:29092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC_RAW_TICKS", "raw-ticks")

# Kafka Producer
producer = None
try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    logger.info(f"Connected to Kafka at {KAFKA_BROKERS}")
except Exception as e:
    logger.error(f"Failed to connect to Kafka: {e}")

api = NorenApiPy()

def normalize_and_publish(tick_data):
    """
    Normalize FlatTrade tick to internal Schema and push to Kafka
    FlatTrade Tick Example:
    {'t': 'tk', 'e': 'NSE', 'tk': '22', 'ts': 'ACC-EQ', 'lp': '2250.05', ...}
    
    Internal Tick:
    {
      symbol: "NSE:ACC-EQ",
      price: 2250.05,
      volume: 100,
      timestamp: <ISO>,
      provider: "flattrade"
    }
    """
    try:
        if 'lp' not in tick_data:
            return

        symbol = f"{tick_data.get('e', 'NSE')}:{tick_data.get('ts', tick_data.get('tk'))}"
        price = float(tick_data.get('lp', 0))
        volume = int(tick_data.get('v', 0))
        # Noren gives time in 'ft' or 'ltt' sometimes, simpler to use ingest time if missing
        timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()) 

        normalized = {
            "symbol": symbol,
            "price": price,
            "volume": volume,
            "timestamp": timestamp,
            "provider": "flattrade",
            "source": "python-layer"
        }
        
        if producer:
            producer.send(KAFKA_TOPIC, normalized)
            # logger.info(f"Published: {symbol} @ {price}") # Verbose
            
    except Exception as e:
        logger.error(f"Error processing tick: {e}")

def event_handler_feed_update(tick_data):
    # logger.info(f"Tick Received: {tick_data}")
    normalize_and_publish(tick_data)

def event_handler_order_update(order_data):
    logger.info(f"Order Update: {order_data}")

def event_handler_socket_open():
    logger.info("WebSocket Connected")

def main():
    if not USER_ID or not API_KEY:
        logger.error("FLATTRADE_USER_ID or FLATTRADE_API_KEY missing.")
        return

    logger.info("Logging in to FlatTrade...")
    try:
        # Note: NorenApiPy login signature might vary based on version. 
        # Using typical params.
        ret = api.login(userid=USER_ID, password=PASSWORD, twoFA=ACT_ID, vendor_code=API_KEY, api_secret=API_SECRET, imei='12345')
        
        if ret:
            logger.info("Login Successful")
            
            # Start Websocket
            api.start_websocket(
                order_update_callback=event_handler_order_update,
                subscribe_callback=event_handler_feed_update, 
                socket_open_callback=event_handler_socket_open
            )
            
            # Subscribe to symbols (Example list)
            # In a real app, we might read this from a shared config or API
            symbols = ['NSE|22', 'NSE|2885'] # ACC, Reliance
            logger.info(f"Subscribing to: {symbols}")
            api.subscribe(symbols)
            
            # Keep alive
            while True:
                time.sleep(10)
        else:
            logger.error("Login Failed")
            
    except Exception as e:
        logger.error(f"Main Loop Error: {e}")

if __name__ == "__main__":
    main()
