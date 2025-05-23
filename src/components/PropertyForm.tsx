'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from '../context/FormContext';
import AddressInput from './AddressInput';
import type { AddressData } from '../types/GooglePlacesTypes';
import { trackEvent, trackConversion } from '../utils/analytics';
import { Loader2, AlertCircle } from 'lucide-react';

interface FormErrors {
  address?: string;
  phone?: string;
  consent?: string;
  submit?: string;
  phoneApi?: string; // For Numverify API errors
}

export default function PropertyForm() {
  const router = useRouter();
  const { formState, updateFormData } = useForm();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isPhoneValidating, setIsPhoneValidating] = useState(false);
  const [isPhoneApiValidated, setIsPhoneApiValidated] = useState(false); // Tracks if API validation has been performed

  const validatePhoneFormat = (phone: string): boolean => {
    const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
    return phoneRegex.test(phone);
  };

  const handleBlur = async (field: keyof FormErrors) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    await validateForm(field);
  };

  const handleAddressSelect = (addressData: AddressData) => {
    trackEvent('property_address_selected', { 
      address: addressData.formattedAddress,
      placeId: addressData.placeId 
    });
    updateFormData(addressData);
    setErrors(prev => ({ ...prev, address: undefined }));
    setTouched(prev => ({ ...prev, address: true }));
    setStep(2);
  };

  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, '');
    if (phone.length < 4) return phone;
    if (phone.length < 7) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    updateFormData({ phone: formatted });
    setIsPhoneApiValidated(false); // Reset API validation status on change
    setErrors(prev => ({ ...prev, phoneApi: undefined }));

    if (touched.phone) {
      const newErrors: FormErrors = { ...errors };
      if (!validatePhoneFormat(formatted)) {
        newErrors.phone = 'Please enter a valid phone number format (XXX) XXX-XXXX';
      } else {
        newErrors.phone = undefined;
      }
      setErrors(newErrors);
    }
  };

  const validateNumverify = async (phoneNumber: string): Promise<boolean> => {
    if (!validatePhoneFormat(phoneNumber)) {
      setErrors(prev => ({ ...prev, phoneApi: 'Invalid phone number format for API validation.' }));
      setIsPhoneApiValidated(true); // Mark as "validated" to unblock UI if needed, error will prevent submission
      return false;
    }

    setIsPhoneValidating(true);
    setErrors(prev => ({ ...prev, phoneApi: undefined }));
    try {
      const response = await fetch('/api/validate-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.replace(/\D/g, '') }), // Send unformatted number
      });
      const result = await response.json();
      setIsPhoneApiValidated(true);

      if (!response.ok || !result) {
        setErrors(prev => ({ ...prev, phoneApi: result.error || 'Phone validation service failed.' }));
        return false;
      }

      if (!result.isValid) {
        setErrors(prev => ({ ...prev, phoneApi: 'This phone number appears to be invalid.' }));
        return false;
      }
      if (!result.isValidLead) {
         setErrors(prev => ({ ...prev, phoneApi: 'Please provide a personal mobile or landline number. Business numbers are not accepted.' }));
        return false;
      }
      
      // If valid and a valid lead, clear API error
      setErrors(prev => ({ ...prev, phoneApi: undefined }));
      updateFormData({ // Optionally store more details from Numverify if needed
        carrier: result.carrier,
        phoneLineType: result.lineType,
      });
      return true;
    } catch (error) {
      console.error('Numverify validation error:', error);
      setErrors(prev => ({ ...prev, phoneApi: 'Could not validate phone number. Check connection.' }));
      setIsPhoneApiValidated(true); // Mark as "validated" to show the error
      return false;
    } finally {
      setIsPhoneValidating(false);
    }
  };

  const validateForm = async (field?: keyof FormErrors): Promise<boolean> => {
    const newErrors: FormErrors = { ...errors };
    let formIsValid = true;

    const currentAddress = formState.address?.trim();
    const currentPhone = formState.phone;
    const currentConsent = formState.consent;

    if (field === 'address' || !field) {
      if (!currentAddress) {
        newErrors.address = 'Please enter a valid property address';
        formIsValid = false;
      } else {
        newErrors.address = undefined;
      }
    }

    if (field === 'phone' || !field) {
      if (!currentPhone) {
        newErrors.phone = 'Phone number is required';
        formIsValid = false;
      } else if (!validatePhoneFormat(currentPhone)) {
        newErrors.phone = 'Please enter a valid phone number format (XXX) XXX-XXXX';
        formIsValid = false;
      } else {
        newErrors.phone = undefined;
        if (currentPhone && field === 'phone' && (!isPhoneApiValidated || newErrors.phoneApi)) {
          if (!await validateNumverify(currentPhone)) {
            formIsValid = false;
          } else {
            newErrors.phoneApi = undefined;
          }
        } else if (errors.phoneApi) {
            formIsValid = false;
        }
      }
    }
    
    if (field === 'consent' || !field) {
      if (!currentConsent) {
        newErrors.consent = 'You must consent to be contacted';
        formIsValid = false;
      } else {
        newErrors.consent = undefined;
      }
    }
    
    setErrors(newErrors);
    return formIsValid && !newErrors.phoneApi;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ address: true, phone: true, consent: true });
    setIsSubmitting(true);

    let localErrors: FormErrors = {};
    let basicValidationPassed = true;

    if (!formState.address?.trim()) {
      localErrors.address = 'Address is required';
      basicValidationPassed = false;
    }
    if (!formState.phone) {
      localErrors.phone = 'Phone number is required';
      basicValidationPassed = false;
    } else if (!validatePhoneFormat(formState.phone)) {
      localErrors.phone = 'Invalid phone format. Please use (XXX) XXX-XXXX';
      basicValidationPassed = false;
    }
    if (!formState.consent) {
      localErrors.consent = 'You must consent to be contacted';
      basicValidationPassed = false;
    }

    if (!basicValidationPassed) {
      setErrors(prev => ({ ...prev, ...localErrors }));
      setIsSubmitting(false);
      return;
    }

    let numverifyCheckPassed = true;
    if (formState.phone) {
      setIsPhoneValidating(true);
      numverifyCheckPassed = await validateNumverify(formState.phone);
    }

    if (!numverifyCheckPassed) {
        setErrors(prev => ({ ...prev, ...localErrors, phoneApi: prev.phoneApi || 'Phone number validation failed.'}));
        setIsSubmitting(false);
        return;
    }

    setErrors({});

    try {
      const dataToSubmit = {
        ...formState,
        lastUpdated: new Date().toISOString()
      };

      console.log('Submitting form data:', {
        address: dataToSubmit.address,
        phone: dataToSubmit.phone,
        consent: dataToSubmit.consent
      });

      const response = await fetch('/api/submit-partial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSubmit)
      });

      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : {};
        if (!response.ok) {
          console.error('API error response:', text);
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        throw new Error(`Failed to parse API response: ${response.status} ${response.statusText}`);
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save lead data');
      }

      updateFormData({ leadId: result.leadId });

      trackEvent('form_submitted', { 
        address: formState.address,
        hasPhone: !!formState.phone
      });

      router.push('/property-listed');

    } catch (error) {
      console.error('Form submission error:', error);
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error ? error.message : 'An error occurred'
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white/90 p-6 rounded-lg shadow-lg">
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Enter Your Property Address</h2>
          <AddressInput 
            onAddressSelect={handleAddressSelect}
            error={touched.address ? errors.address : undefined}
          />
          {errors.address && touched.address && (
            <div className="flex items-center space-x-1 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{errors.address}</span>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Enter Your Phone Number</h2>
          <div className="space-y-1">
            <input
              type="tel"
              placeholder="(555) 555-5555"
              className={`w-full px-4 py-3 text-lg border rounded-lg transition-colors
                ${errors.phone && touched.phone 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-primary'}
                focus:ring-2 focus:border-transparent`}
              value={formState.phone || ''}
              onChange={handlePhoneChange}
              onBlur={() => handleBlur('phone')}
              maxLength={14}
              required
              aria-invalid={Boolean(errors.phone && touched.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
            />
            
            {errors.phone && touched.phone && !errors.phoneApi && (
              <div id="phone-error" className="flex items-center space-x-1 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.phone}</span>
              </div>
            )}
            {errors.phoneApi && touched.phone && (
              <div id="phone-api-error" className="flex items-center space-x-1 text-red-500 text-sm mt-1">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.phoneApi}</span>
              </div>
            )}
            {isPhoneValidating && (
              <div className="flex items-center space-x-1 text-sm text-gray-600 mt-1">
                <Loader2 className="animate-spin h-4 w-4" />
                <span>Validating phone...</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 text-secondary border-gray-300 rounded focus:ring-secondary"
                checked={formState.consent || false}
                onChange={(e) => updateFormData({ consent: e.target.checked })}
                onBlur={() => handleBlur('consent')}
                required
              />
              <span className="text-sm text-gray-600">
                By checking this box, I consent to being contacted by phone, email, or text message about my property sale inquiry, including through auto-dialed or pre-recorded messages.
              </span>
            </label>
            {errors.consent && touched.consent && (
              <div className="flex items-center space-x-1 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.consent}</span>
              </div>
            )}
          </div>
          
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isPhoneValidating || !!errors.phoneApi || !!errors.phone || !!errors.address || !!errors.consent}
            onClick={() => {
              if (formState.phone && formState.consent && !errors.phone && !errors.phoneApi && !isSubmitting && !isPhoneValidating) {
                trackConversion('AW-17041108639', 'sghECKX6-fkYELD4yf8p');
              }
            }}
            className={`w-full px-4 py-3 text-lg font-semibold text-white bg-secondary rounded-lg hover:bg-secondary/90 transition-colors
              ${(isSubmitting || isPhoneValidating || !!errors.phoneApi || !!errors.phone || !!errors.address || !!errors.consent) ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                Submitting...
              </span>
            ) : (
              'Get Your Cash Offer'
            )}
          </button>
        </div>
      )}
    </form>
  );
}