import os
from app import app as application

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5002"))
    application.run(host="0.0.0.0", port=port)