from pydantic import BaseModel, EmailStr, field_validator

MAX_PASSWORD_BYTES = 72

class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, password: str) -> str:
        """Reject passwords longer than bcrypt's 72-byte input limit."""
        if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
        return password

class UserResponse(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str