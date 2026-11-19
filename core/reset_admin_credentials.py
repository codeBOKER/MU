import asyncio
from getpass import getpass

from sqlmodel import select

from app.db.session import async_session_factory
from app.models.admin import AdminUser
from app.services.auth_service import hash_password


async def main():
    old_email = input("Current admin email: ").strip().lower()
    new_email = input("New admin email: ").strip().lower()

    password = getpass("New password: ")
    confirm = getpass("Confirm new password: ")

    if not new_email or "@" not in new_email:
        print("Invalid email.")
        return

    if password != confirm:
        print("Passwords do not match.")
        return

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        return

    async with async_session_factory() as session:
        result = await session.execute(
            select(AdminUser).where(AdminUser.email == old_email)
        )
        admin = result.scalar_one_or_none()

        if not admin:
            print("Old admin account not found.")
            return

        duplicate = await session.execute(
            select(AdminUser).where(AdminUser.email == new_email)
        )
        existing = duplicate.scalar_one_or_none()

        if existing and existing.id != admin.id:
            print("New email is already registered.")
            return

        admin.email = new_email
        admin.password_hash = hash_password(password)

        await session.commit()

        print("Admin credentials updated successfully.")
        print(f"New email: {admin.email}")


if __name__ == "__main__":
    asyncio.run(main())
