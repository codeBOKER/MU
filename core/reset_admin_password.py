import asyncio
from getpass import getpass

from sqlmodel import select

from app.db.session import async_session_factory
from app.models.admin import AdminUser
from app.services.auth_service import hash_password


async def main():
    email = input("Admin email: ").strip().lower()
    password = getpass("New password: ")
    confirm = getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.")
        return

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        return

    async with async_session_factory() as session:
        result = await session.execute(
            select(AdminUser).where(AdminUser.email == email)
        )
        admin = result.scalar_one_or_none()

        if not admin:
            print("Admin account not found.")
            return

        admin.password_hash = hash_password(password)
        admin.is_active = True

        await session.commit()

        print(f"Password reset successfully for {admin.email}")


if __name__ == "__main__":
    asyncio.run(main())
