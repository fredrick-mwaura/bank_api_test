# Authentication API Endpoints

## POST /api/auth/register

Register a new user account.

### Request

**URL:** `POST /api/auth/register`

**Headers:**
\`\`\`
Content-Type: application/json
Accept: application/json
\`\`\`

**Body Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| firstName | string | Yes | User's first name (2-50 characters, letters and spaces only) |
| lastName | string | Yes | User's last name (2-50 characters, letters and spaces only) |
| email | string | Yes | Valid email address |
| password | string | Yes | Password (min 8 chars, must contain uppercase, lowercase, number, special char) |
| phoneNumber | string | Yes | Valid mobile phone number |
| dateOfBirth | string | Yes | Date in ISO format (YYYY-MM-DD), user must be 18+ |
| ssn | string | Yes | Social Security Number in format XXX-XX-XXXX |

**Example Request:**
\`\`\`json
{
  "firstName": "fredrick",
  "lastName": "mwaura",
  "email": "fredrick.mwaurae@example.com",
  "password": "password",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "2000-05-15",
  "ssn": "123-45-6789"
}
\`\`\`

### Response

#### Success Response (201 Created)

\`\`\`json
{
  "status": "success",
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "firstName": "fredrick",
      "lastName": "mwaura",
      "email": "fredrick.mwaura@example.com",
      "isEmailVerified": false
    }
  }
}
\`\`\`

#### Error Response (422 Validation Error)

\`\`\`json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "email": ["Please provide a valid email address"],
    "password": ["Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"]
  }
}
\`\`\`

#### Error Response (409 Conflict)

\`\`\`json
{
  "status": "error",
  "message": "Email address is already registered"
}
\`\`\`

#### Error Response (500 Internal Server Error)

\`\`\`json
{
  "status": "error",
  "message": "Registration failed. Please try again."
}
\`\`\`

### Rate Limiting

This endpoint is rate limited to prevent abuse:
- 5 requests per 15 minutes per IP address

### Security Notes

- Password is hashed using bcrypt with high rounds
- SSN is encrypted before storage
- Email verification is required before account activation
- All registration attempts are logged for audit purposes

### Next Steps

After successful registration:
1. User receives email verification link
2. User must verify email to activate account
3. User can then login with credentials
4. Account status will be "inactive" until email verification
