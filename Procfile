web: python --version && pip install -r requirements.txt && npm install && npm run build && python -m gunicorn wsgi:application --log-file=- --access-logfile=- --error-logfile=- --capture-output
