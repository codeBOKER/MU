import asyncio
from getpass import getpass

from sqlmodel import select

from app.db.session import async_session_factory
from app.models.admin import AdminUser
from app.services.auth_service import verify_password


async def main():
    email = input("Admin email: ").strip().lower()
    password = getpass("Admin password: ")

    async with async_session_factory() as session:
        result = await session.exec(
            select(AdminUser).where(AdminUser.email == email)
        )
        admin = result.first()

        if not admin:
            print("Admin not found in this database.")
            return

        print("Account active:", admin.is_active)
        print("Password valid:", verify_password(password, admin.password_hash))


if __name__ == "__main__":
    asyncio.run(main())

