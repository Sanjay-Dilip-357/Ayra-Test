from flask import request, jsonify, current_app
from routes import otp_bp
import requests

@otp_bp.route('/send', methods=['POST'])
def send_otp():
    """Send OTP to mobile number using KSP API"""
    try:
        data = request.get_json()
        mobile_number = data.get('mobileNumber', '')
        
        # Validate mobile number
        if not mobile_number or len(mobile_number) != 10 or not mobile_number.isdigit():
            return jsonify({
                'success': False,
                'message': 'Please enter a valid 10-digit mobile number'
            }), 400
        
        # Call KSP API to send OTP
        otp_send_url = current_app.config.get('OTP_SEND_URL')
        
        payload = {
            'mobileNumber': mobile_number
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(
            otp_send_url,
            data=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            return jsonify({
                'success': True,
                'message': 'OTP sent successfully to your mobile number'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to send OTP. Please try again.'
            }), 400
            
    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'message': 'Request timeout. Please try again.'
        }), 408
        
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f'OTP Send Error: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Failed to send OTP. Service unavailable.'
        }), 503
        
    except Exception as e:
        current_app.logger.error(f'OTP Send Error: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again.'
        }), 500


@otp_bp.route('/verify', methods=['POST'])
def verify_otp():
    """Verify OTP using KSP API"""
    try:
        data = request.get_json()
        mobile_number = data.get('mobileNumber', '')
        otp = data.get('otp', '')
        
        # Validate inputs
        if not mobile_number or len(mobile_number) != 10:
            return jsonify({
                'success': False,
                'message': 'Invalid mobile number'
            }), 400
        
        if not otp or len(otp) < 4 or len(otp) > 6:
            return jsonify({
                'success': False,
                'message': 'Please enter a valid OTP'
            }), 400
        
        # Call KSP API to verify OTP
        otp_verify_url = current_app.config.get('OTP_VERIFY_URL')
        
        payload = {
            'mobileNumber': mobile_number,
            'otp': otp
        }
        
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(
            otp_verify_url,
            data=payload,
            headers=headers,
            timeout=30
        )
        
        # Status 200 = OTP Matched
        if response.status_code == 200:
            return jsonify({
                'success': True,
                'message': 'OTP verified successfully'
            }), 200
        
        # Status 400 = OTP Mismatched
        elif response.status_code == 400:
            return jsonify({
                'success': False,
                'message': 'Invalid OTP. Please enter the correct OTP.'
            }), 400
        
        else:
            return jsonify({
                'success': False,
                'message': 'OTP verification failed. Please try again.'
            }), response.status_code
            
    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'message': 'Request timeout. Please try again.'
        }), 408
        
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f'OTP Verify Error: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'Verification failed. Service unavailable.'
        }), 503
        
    except Exception as e:
        current_app.logger.error(f'OTP Verify Error: {str(e)}')
        return jsonify({
            'success': False,
            'message': 'An error occurred. Please try again.'
        }), 500