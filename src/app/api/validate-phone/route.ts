import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let { phoneNumber } = await request.json();

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
  }

  // Prepend US country code if not already present (assuming US numbers)
  if (typeof phoneNumber === 'string' && !phoneNumber.startsWith('1')) {
    phoneNumber = '1' + phoneNumber;
  }

  const accessKey = process.env.NUMVERIFY_API_KEY;

  if (!accessKey) {
    console.error('Numverify API key is not configured.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const numverifyUrl = `http://apilayer.net/api/validate?access_key=${accessKey}&number=${phoneNumber}`;

  try {
    const response = await fetch(numverifyUrl);
    const data = await response.json();

    if (data.success === false) {
      // Handle Numverify API errors
      console.error('Numverify API error for number:', phoneNumber, 'Error:', data.error);
      let errorMessage = 'Phone number validation failed.';
      if (data.error && data.error.info) {
        errorMessage = data.error.info;
      } else if (data.error && data.error.type) {
         switch (data.error.type) {
          case 'no_phone_number_provided':
          case 'non_numeric_phone_number_provided':
            errorMessage = 'Invalid phone number format provided.';
            break;
          case 'invalid_country_code':
            errorMessage = 'Invalid country code for the phone number.';
            break;
          default:
            errorMessage = 'Could not validate phone number at this time.';
        }
      }
      return NextResponse.json({ error: errorMessage, validationData: null }, { status: 400 });
    }
    
    // Determine if the lead should be accepted based on validity and line type
    const isValidLead = data.valid && (data.line_type === 'mobile' || data.line_type === 'landline');

    return NextResponse.json({
      isValid: data.valid,
      lineType: data.line_type,
      carrier: data.carrier,
      internationalFormat: data.international_format,
      localFormat: data.local_format,
      countryCode: data.country_code,
      isValidLead: isValidLead, // True if valid and (mobile or landline)
      rawResponse: data // For debugging or further use
    }, { status: 200 });

  } catch (error) {
    console.error('Error calling Numverify API:', error);
    return NextResponse.json({ error: 'Failed to validate phone number due to a network or server error.' }, { status: 500 });
  }
} 