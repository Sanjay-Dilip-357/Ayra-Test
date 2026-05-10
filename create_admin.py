import os
import sys
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from models import db, User, init_db
from config import DATABASE_PATH, DEFAULT_ADMIN_PASSWORD

def create_app():
    """Create Flask app for database operations"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{DATABASE_PATH}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    init_db(app)
    return app

def create_admin(name, email, password=None):
    """Create an admin user"""
    app = create_app()
    
    with app.app_context():
        # Check if email already exists
        existing = User.get_by_email(email)
        if existing:
            print(f"❌ Error: User with email '{email}' already exists!")
            print(f"   Role: {existing.role}")
            return False
        
        # Create admin
        admin = User(
            name=name,
            email=email.lower(),
            role='admin',
            is_active=True
        )
        admin.set_password(password or DEFAULT_ADMIN_PASSWORD)
        
        db.session.add(admin)
        db.session.commit()
        
        print("\n" + "="*50)
        print("✅ Admin Created Successfully!")
        print("="*50)
        print(f"   Name:     {name}")
        print(f"   Email:    {email}")
        print(f"   Password: {password or DEFAULT_ADMIN_PASSWORD}")
        print(f"   Role:     Administrator")
        print("="*50)
        print("\nYou can now login at: http://localhost:5000/")
        print("="*50 + "\n")
        
        return True

def list_admins():
    """List all admin users"""
    app = create_app()
    
    with app.app_context():
        admins = User.query.filter_by(role='admin').all()
        
        if not admins:
            print("\n❌ No admin users found.\n")
            return
        
        print("\n" + "="*60)
        print("📋 Admin Users")
        print("="*60)
        
        for i, admin in enumerate(admins, 1):
            status = "🟢 Active" if admin.is_active else "🔴 Inactive"
            last_login = admin.last_login.strftime("%Y-%m-%d %H:%M") if admin.last_login else "Never"
            print(f"\n{i}. {admin.name}")
            print(f"   Email:      {admin.email}")
            print(f"   Status:     {status}")
            print(f"   Last Login: {last_login}")
        
        print("\n" + "="*60 + "\n")

def reset_admin_password(email, new_password=None):
    """Reset admin password"""
    app = create_app()
    
    with app.app_context():
        admin = User.get_by_email(email)
        
        if not admin:
            print(f"❌ Error: No user found with email '{email}'")
            return False
        
        if admin.role != 'admin':
            print(f"❌ Error: User '{email}' is not an admin")
            return False
        
        password = new_password or DEFAULT_ADMIN_PASSWORD
        admin.set_password(password)
        db.session.commit()
        
        print("\n" + "="*50)
        print("✅ Password Reset Successfully!")
        print("="*50)
        print(f"   Email:        {email}")
        print(f"   New Password: {password}")
        print("="*50 + "\n")
        
        return True

def delete_admin(email):
    """Delete an admin user"""
    app = create_app()
    
    with app.app_context():
        admin = User.get_by_email(email)
        
        if not admin:
            print(f"❌ Error: No user found with email '{email}'")
            return False
        
        if admin.role != 'admin':
            print(f"❌ Error: User '{email}' is not an admin")
            return False
        
        # Check if this is the last admin
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            print("❌ Error: Cannot delete the last admin user!")
            return False
        
        db.session.delete(admin)
        db.session.commit()
        
        print(f"\n✅ Admin '{email}' deleted successfully!\n")
        return True

def interactive_create():
    """Interactive admin creation"""
    print("\n" + "="*50)
    print("🛡️  AYRA Services - Admin Creation")
    print("="*50 + "\n")
    
    name = input("Enter admin name: ").strip()
    if not name:
        print("❌ Name is required!")
        return
    
    email = input("Enter admin email: ").strip()
    if not email:
        print("❌ Email is required!")
        return
    
    use_default = input(f"Use default password '{DEFAULT_ADMIN_PASSWORD}'? (Y/n): ").strip().lower()
    
    if use_default == 'n':
        password = input("Enter custom password: ").strip()
        if len(password) < 8:
            print("❌ Password must be at least 8 characters!")
            return
    else:
        password = DEFAULT_ADMIN_PASSWORD
    
    create_admin(name, email, password)

def main():
    parser = argparse.ArgumentParser(description='AYRA Services Admin Management')
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Create command
    create_parser = subparsers.add_parser('create', help='Create a new admin')
    create_parser.add_argument('--name', '-n', help='Admin name')
    create_parser.add_argument('--email', '-e', help='Admin email')
    create_parser.add_argument('--password', '-p', help='Admin password (optional)')
    
    # List command
    subparsers.add_parser('list', help='List all admins')
    
    # Reset password command
    reset_parser = subparsers.add_parser('reset-password', help='Reset admin password')
    reset_parser.add_argument('--email', '-e', required=True, help='Admin email')
    reset_parser.add_argument('--password', '-p', help='New password (optional)')
    
    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete an admin')
    delete_parser.add_argument('--email', '-e', required=True, help='Admin email')
    
    args = parser.parse_args()
    
    if args.command == 'create':
        if args.name and args.email:
            create_admin(args.name, args.email, args.password)
        else:
            interactive_create()
    
    elif args.command == 'list':
        list_admins()
    
    elif args.command == 'reset-password':
        reset_admin_password(args.email, args.password)
    
    elif args.command == 'delete':
        confirm = input(f"Are you sure you want to delete admin '{args.email}'? (yes/no): ")
        if confirm.lower() == 'yes':
            delete_admin(args.email)
        else:
            print("Cancelled.")
    
    else:
        # No command specified, run interactive mode
        print("\n🛡️  AYRA Services Admin Management\n")
        print("Commands:")
        print("  1. Create new admin")
        print("  2. List all admins")
        print("  3. Reset admin password")
        print("  4. Delete admin")
        print("  5. Exit\n")
        
        choice = input("Select option (1-5): ").strip()
        
        if choice == '1':
            interactive_create()
        elif choice == '2':
            list_admins()
        elif choice == '3':
            email = input("Enter admin email: ").strip()
            reset_admin_password(email)
        elif choice == '4':
            email = input("Enter admin email to delete: ").strip()
            confirm = input(f"Are you sure you want to delete '{email}'? (yes/no): ")
            if confirm.lower() == 'yes':
                delete_admin(email)
        elif choice == '5':
            print("Goodbye!")
        else:
            print("Invalid option!")

if __name__ == '__main__':
    main()