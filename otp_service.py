# otp_service.py - OTP Service for KSP API

import requests
from datetime import datetime, timedelta

class OTPService:
    """
    OTP Service using KSP API
    
    Send URL: https://kspapp.ksp.gov.in/ksp/api/traffic-challan/getotp
    Verify URL: https://kspapp.ksp.gov.in/ksp/api/traffic-challan/verify-otp
    """
    
    SEND_URL = 'https://kspapp.ksp.gov.in/ksp/api/traffic-challan/getotp'
    VERIFY_URL = 'https://kspapp.ksp.gov.in/ksp/api/traffic-challan/verify-otp'
    
    # Store session for maintaining cookies between requests
    _sessions = {}
    
    # OTP tracking (phone -> {otp_sent_at, attempts, session})
    _otp_tracking = {}
    
    @classmethod
    def _get_session(cls, phone):
        """Get or create a session for a phone number"""
        if phone not in cls._sessions:
            cls._sessions[phone] = requests.Session()
        return cls._sessions[phone]
    
    @classmethod
    def _clear_session(cls, phone):
        """Clear session for a phone number"""
        if phone in cls._sessions:
            del cls._sessions[phone]
        if phone in cls._otp_tracking:
            del cls._otp_tracking[phone]
    
    @classmethod
    def validate_phone(cls, phone):
        """Validate phone number format"""
        if not phone:
            return False, "Phone number is required"
        
        # Remove any non-digit characters
        phone = ''.join(filter(str.isdigit, str(phone)))
        
        if len(phone) != 10:
            return False, "Phone number must be 10 digits"
        
        if not phone.isdigit():
            return False, "Phone number must contain only digits"
        
        # Indian mobile numbers start with 6, 7, 8, or 9
        if phone[0] not in ['6', '7', '8', '9']:
            return False, "Invalid Indian mobile number"
        
        return True, phone
    
    @classmethod
    def validate_otp(cls, otp):
        """Validate OTP format"""
        if not otp:
            return False, "OTP is required"
        
        # Remove any whitespace
        otp = str(otp).strip()
        
        if not otp.isdigit():
            return False, "OTP must contain only digits"
        
        # KSP OTP is 5 digits
        if len(otp) != 5:
            return False, "OTP must be 5 digits"
        
        return True, otp
    
    @classmethod
    def send_otp(cls, phone):
        """
        Send OTP to mobile number
        
        Args:
            phone: 10-digit mobile number
            
        Returns:
            dict: {success: bool, message: str, data: dict}
        """
        # Validate phone
        is_valid, result = cls.validate_phone(phone)
        if not is_valid:
            return {
                'success': False,
                'message': result,
                'data': None
            }
        
        phone = result  # Cleaned phone number
        
        try:
            # Get or create session for this phone
            session = cls._get_session(phone)
            
            # Prepare request
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            payload = {
                'mobileNumber': phone
            }
            
            print(f"[OTP Service] Sending OTP to {phone}")
            print(f"[OTP Service] URL: {cls.SEND_URL}")
            print(f"[OTP Service] Payload: {payload}")
            
            # Send request
            response = session.post(
                cls.SEND_URL,
                data=payload,
                headers=headers,
                timeout=30
            )
            
            print(f"[OTP Service] Response Status: {response.status_code}")
            print(f"[OTP Service] Response Headers: {dict(response.headers)}")
            print(f"[OTP Service] Response Body: {response.text[:500] if response.text else 'Empty'}")
            
            if response.status_code == 200:
                # Track OTP send time
                cls._otp_tracking[phone] = {
                    'sent_at': datetime.now(),
                    'attempts': 0,
                    'session': session
                }
                
                return {
                    'success': True,
                    'message': 'OTP sent successfully',
                    'data': {
                        'phone': phone,
                        'sent_at': datetime.now().isoformat()
                    }
                }
            else:
                return {
                    'success': False,
                    'message': f'Failed to send OTP (Status: {response.status_code})',
                    'data': {
                        'status_code': response.status_code,
                        'response': response.text[:200] if response.text else None
                    }
                }
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'message': 'Request timeout. Please try again.',
                'data': None
            }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'message': 'Connection error. Please check your internet.',
                'data': None
            }
        except Exception as e:
            print(f"[OTP Service] Send Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'data': None
            }
    
    @classmethod
    def verify_otp(cls, phone, otp):
        """
        Verify OTP
        
        Args:
            phone: 10-digit mobile number
            otp: 5-digit OTP
            
        Returns:
            dict: {success: bool, message: str, verified: bool, data: dict}
        """
        # Validate phone
        is_valid, result = cls.validate_phone(phone)
        if not is_valid:
            return {
                'success': False,
                'message': result,
                'verified': False,
                'data': None
            }
        phone = result
        
        # Validate OTP
        is_valid, result = cls.validate_otp(otp)
        if not is_valid:
            return {
                'success': False,
                'message': result,
                'verified': False,
                'data': None
            }
        otp = result
        
        try:
            # Use the same session that was used to send OTP
            if phone in cls._otp_tracking and 'session' in cls._otp_tracking[phone]:
                session = cls._otp_tracking[phone]['session']
                print(f"[OTP Service] Using existing session for {phone}")
            else:
                session = cls._get_session(phone)
                print(f"[OTP Service] Creating new session for {phone}")
            
            # Track attempts
            if phone in cls._otp_tracking:
                cls._otp_tracking[phone]['attempts'] += 1
            
            # Prepare request
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            payload = {
                'mobileNumber': phone,
                'otp': otp
            }
            
            print(f"[OTP Service] Verifying OTP for {phone}")
            print(f"[OTP Service] URL: {cls.VERIFY_URL}")
            print(f"[OTP Service] Payload: {payload}")
            
            # Send request
            response = session.post(
                cls.VERIFY_URL,
                data=payload,
                headers=headers,
                timeout=30
            )
            
            print(f"[OTP Service] Response Status: {response.status_code}")
            print(f"[OTP Service] Response Body: {response.text[:500] if response.text else 'Empty'}")
            
            # Status 200 = OTP Verified
            if response.status_code == 200:
                # Clear session after successful verification
                cls._clear_session(phone)
                
                return {
                    'success': True,
                    'message': 'OTP verified successfully',
                    'verified': True,
                    'data': {
                        'phone': phone,
                        'verified_at': datetime.now().isoformat()
                    }
                }
            
            # Status 400 = OTP Mismatched
            elif response.status_code == 400:
                attempts = cls._otp_tracking.get(phone, {}).get('attempts', 0)
                remaining = max(0, 3 - attempts)
                
                return {
                    'success': True,  # Request succeeded, but OTP didn't match
                    'message': f'Invalid OTP. {remaining} attempts remaining.',
                    'verified': False,
                    'data': {
                        'phone': phone,
                        'attempts': attempts,
                        'remaining': remaining
                    }
                }
            
            else:
                return {
                    'success': False,
                    'message': f'Verification failed (Status: {response.status_code})',
                    'verified': False,
                    'data': {
                        'status_code': response.status_code,
                        'response': response.text[:200] if response.text else None
                    }
                }
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'message': 'Request timeout. Please try again.',
                'verified': False,
                'data': None
            }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'message': 'Connection error. Please check your internet.',
                'verified': False,
                'data': None
            }
        except Exception as e:
            print(f"[OTP Service] Verify Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'verified': False,
                'data': None
            }
    
    @classmethod
    def can_resend(cls, phone):
        """Check if OTP can be resent (after 60 seconds)"""
        if phone not in cls._otp_tracking:
            return True, 0
        
        sent_at = cls._otp_tracking[phone].get('sent_at')
        if not sent_at:
            return True, 0
        
        elapsed = (datetime.now() - sent_at).total_seconds()
        wait_time = 60 - int(elapsed)
        
        if elapsed >= 60:
            return True, 0
        else:
            return False, wait_time
    
    @classmethod
    def get_status(cls, phone):
        """Get OTP status for a phone number"""
        if phone not in cls._otp_tracking:
            return {
                'otp_sent': False,
                'sent_at': None,
                'attempts': 0,
                'can_resend': True,
                'wait_time': 0
            }
        
        tracking = cls._otp_tracking[phone]
        can_resend, wait_time = cls.can_resend(phone)
        
        return {
            'otp_sent': True,
            'sent_at': tracking.get('sent_at').isoformat() if tracking.get('sent_at') else None,
            'attempts': tracking.get('attempts', 0),
            'can_resend': can_resend,
            'wait_time': wait_time
        }


# ==================== STANDALONE TEST ====================
if __name__ == '__main__':
    print("=" * 60)
    print("OTP Service Test")
    print("=" * 60)
    
    # Get phone number from user
    phone = input("\nEnter 10-digit mobile number: ").strip()
    
    # Validate
    is_valid, result = OTPService.validate_phone(phone)
    if not is_valid:
        print(f"❌ Invalid phone: {result}")
        exit(1)
    
    phone = result
    print(f"✅ Phone validated: {phone}")
    
    # Send OTP
    print("\n" + "-" * 40)
    print("Sending OTP...")
    send_result = OTPService.send_otp(phone)
    
    print(f"\nSend Result: {send_result}")
    
    if not send_result['success']:
        print(f"❌ Failed to send OTP: {send_result['message']}")
        exit(1)
    
    print(f"✅ OTP sent successfully!")
    
    # Get OTP from user
    print("\n" + "-" * 40)
    otp = input("Enter the 5-digit OTP you received: ").strip()
    
    # Verify OTP
    print("\nVerifying OTP...")
    verify_result = OTPService.verify_otp(phone, otp)
    
    print(f"\nVerify Result: {verify_result}")
    
    if verify_result.get('verified'):
        print(f"✅ OTP verified successfully!")
    else:
        print(f"❌ OTP verification failed: {verify_result['message']}")
    
    print("\n" + "=" * 60)