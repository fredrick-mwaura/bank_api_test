#!/bin/bash
# register req
echo "=== Basic Registration Request ==="
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "StrongPass123!",
    "phoneNumber": "+254734567890",
    "dateOfBirth": "1995-06-15",
    "ssn": "123-45-6789"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n\n"

# Registration with different user data
echo "=== Alternative Registration Request ==="
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@nail.com",
    "password": "SecurePass456!",
    "phoneNumber": "+254712345678",
    "dateOfBirth": "1988-03-22",
    "ssn": "987-65-4321"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n\n"

# Test validation errors
echo "=== Testing Validation Errors ==="
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "A",
    "lastName": "",
    "email": "invalid-email",
    "password": "weak",
    "phoneNumber": "invalid",
    "dateOfBirth": "2010-01-01",
    "ssn": "invalid-ssn"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo -e "\n\n"

# Test duplicate email
echo "=== Testing Duplicate Email ==="
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "fred",
    "lastName": "mwaura",
    "email": "fred@gmail.com",
    "password": "Hehe@0101!",
    "phoneNumber": "+254734567891",
    "dateOfBirth": "1995-06-15",
    "ssn": "409-45-9088"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
