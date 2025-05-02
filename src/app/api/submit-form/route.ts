import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { LeadFormData } from '@/types';
import { rateLimit } from '@/utils/rateLimit';

// Validate complete form data
function validateFormData(data: Partial<LeadFormData>): data is LeadFormData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format');
  }

  // Required fields validation
  const requiredFields: (keyof LeadFormData)[] = [
    'address', 'phone', 'firstName', 'lastName', 
    'email', 'propertyCondition', 'timeframe', 'price',
    'leadId'
  ];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`${field} is required`);
    }
  }

  // Phone number validation
  const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
  if (!phoneRegex.test(data.phone as string)) {
    throw new Error('Invalid phone number format');
  }

  return true;
}

// Send data to Go High Level API
async function sendToGoHighLevel(data: LeadFormData) {
  if (!process.env.GO_HIGH_LEVEL_API_KEY || !process.env.GO_HIGH_LEVEL_LOCATION_ID) {
    throw new Error('Go High Level API credentials not configured');
  }

  try {
    // Format phone number for API (remove formatting)
    const phone = data.phone ? data.phone.replace(/\D/g, '') : '';
    
    // Create a comprehensive notes section with all form data
    const formattedTimestamp = new Date().toLocaleString();
    let notes = `Complete Lead Submission (${formattedTimestamp}):\n\n`;
    
    // Property Information
    notes += `PROPERTY INFORMATION:\n`;
    notes += `- Property Address: ${data.address || 'Not provided'}\n`;
    if (data.streetAddress) notes += `- Street Address: ${data.streetAddress}\n`;
    if (data.city) notes += `- City: ${data.city}\n`;
    if (data.state) notes += `- State: ${data.state}\n`;
    if (data.postalCode) notes += `- Postal Code: ${data.postalCode}\n`;
    if (data.placeId) notes += `- Google Place ID: ${data.placeId}\n`;
    notes += `- Property Condition: ${data.propertyCondition || 'Not provided'}\n`;
    notes += `- Is Property Listed: ${data.isPropertyListed ? 'Yes' : 'No'}\n`;
    notes += `- Asking Price: ${data.price || 'Not provided'}\n`;
    notes += `- Timeframe: ${data.timeframe || 'Not provided'}\n`;
    
    // Contact Information
    notes += `\nCONTACT INFORMATION:\n`;
    notes += `- Full Name: ${data.firstName} ${data.lastName}\n`;
    notes += `- Phone: ${data.phone}\n`;
    notes += `- Email: ${data.email}\n`;
    
    // Additional Details
    notes += `\nADDITIONAL DETAILS:\n`;
    notes += `- Lead ID: ${data.leadId}\n`;
    notes += `- Initial Submission: ${data.timestamp || 'Unknown'}\n`;
    notes += `- Complete Submission: ${formattedTimestamp}\n`;
    
    if (data.comments) {
      notes += `\nCOMMENTS:\n${data.comments}\n`;
    }
    
    if (data.referralSource) {
      notes += `\nReferral Source: ${data.referralSource}\n`;
    }
    
    // Prepare contact data for Go High Level
    const contactData = {
      name: `${data.firstName} ${data.lastName}`,
      phone: phone,
      email: data.email,
      address1: data.address || '',
      city: data.city || '',
      state: data.state || '',
      postalCode: data.postalCode || '',
      locationId: process.env.GO_HIGH_LEVEL_LOCATION_ID,
      source: 'Website Lead Form',
      
      // Map fields directly to Go High Level custom fields using provided keys
      customField: {
        "ppc_address": data.address || '',
        "ppc_condition": data.propertyCondition || '',
        "ppc_timeframe": data.timeframe || '',
        "ppc_property_listed": data.isPropertyListed ? 'Yes' : 'No',
        "ppc_asking_price": data.price || ''
      },
      
      tags: ['Website Lead', 'Complete Lead'],
      notes: notes,
      customData: {
        leadId: data.leadId,
        submissionType: 'complete',
        timestamp: new Date().toISOString()
      }
    };

    // First search if the lead with this ID already exists
    const searchResponse = await fetch(`https://rest.gohighlevel.com/v1/contacts/lookup?locationId=${process.env.GO_HIGH_LEVEL_LOCATION_ID}&lookupField=phone&lookupValue=${phone}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`
      }
    });

    let response;
    
    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      
      if (searchResult.contacts && searchResult.contacts.length > 0) {
        // Contact exists, update it
        const contactId = searchResult.contacts[0].id;
        
        // For updates, append a note instead of overwriting existing notes
        const getContactResponse = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`
          }
        });
        
        if (getContactResponse.ok) {
          const contactDetails = await getContactResponse.json();
          
          // Append new notes to existing notes if there are any
          if (contactDetails && contactDetails.notes) {
            contactData.notes = `${contactDetails.notes}\n\n${notes}`;
          }
        }
        
        response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`
          },
          body: JSON.stringify(contactData)
        });
      } else {
        // Contact doesn't exist, create new one
        response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`
          },
          body: JSON.stringify(contactData)
        });
      }
    } else {
      // Search failed, try to create a new contact
      response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`
        },
        body: JSON.stringify(contactData)
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Go High Level API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to send to Go High Level: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error in sendToGoHighLevel:', error);
    throw error;
  }
}

/**
 * API Route for saving complete property details
 * Used for full form submissions with all property information
 */
export async function POST(request: Request) {
  try {
    // Log incoming request
    console.log('Received complete form submission request');

    // 1. Rate limiting check
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    const timestamp = new Date().toISOString();
    
    const rateLimitResult = await rateLimit(ip);
    if (!rateLimitResult.success) {
      console.log('Rate limit exceeded for IP:', ip);
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // 2. Parse and validate request data
    let data;
    try {
      data = await request.json();
      console.log('Received form data:', {
        hasRequiredFields: true,
        leadId: data.leadId
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (!validateFormData(data)) {
      console.error('Invalid form data:', data);
      return NextResponse.json(
        { error: 'Invalid form data - Missing required fields or invalid format' },
        { status: 400 }
      );
    }

    // 3. Prepare data with tracking information
    const formData: LeadFormData = {
      ...data,
      timestamp: data.timestamp || timestamp,
      lastUpdated: timestamp
    };

    // 4. Send to Go High Level API
    try {
      const result = await sendToGoHighLevel(formData);
      console.log('Successfully sent to Go High Level API');
      
      return NextResponse.json({ 
        success: true,
        leadId: formData.leadId,
        contactId: result.id
      });
    } catch (error) {
      console.error('Failed to send to Go High Level:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error submitting form:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
} 