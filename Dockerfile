# 1. Use an official Python runtime as a parent image, specifying Python 3.12
FROM python:3.12-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Set environment variables to prevent Python from writing .pyc files and to run in unbuffered mode
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 4. Copy the requirements file into the container at /app
# This step is done first to leverage Docker's layer caching.
# Dependencies will only be re-installed if requirements.txt changes.
COPY requirements.txt .

# 5. Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of your application's code from your host to your image filesystem.
COPY . .

# 7. Define the command to run your app using Gunicorn.
# This command is robust for production environments like Google Cloud Run.
# It automatically uses the $PORT environment variable provided by Cloud Run.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app