import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { LeadFormData } from '@/types';
import { rateLimit } from '@/utils/rateLimit';

// Validate partial form data (only address and phone)
function validatePartialData(data: Partial<LeadFormData>): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // Check required fields
  if (!data.address || !data.phone) return false;
  
  // Phone validation
  const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
  if (!phoneRegex.test(data.phone)) return false;
  
  return true;
}

// Send data to Go High Level API
async function sendToGoHighLevel(data: Partial<LeadFormData>) {
  if (!process.env.GO_HIGH_LEVEL_API_KEY || !process.env.GO_HIGH_LEVEL_LOCATION_ID) {
    throw new Error('Go High Level API credentials not configured');
  }

  try {
    // Format phone number for API (remove formatting)
    const phone = data.phone ? data.phone.replace(/\D/g, '') : '';
    
    // Create a formatted notes section with all form data
    const formattedTimestamp = new Date().toLocaleString();
    let notes = `Initial Lead Submission (${formattedTimestamp}):\n`;
    notes += `- Property Address: ${data.address || 'Not provided'}\n`;
    notes += `- Phone: ${data.phone || 'Not provided'}\n`;
    
    if (data.consent) {
      notes += `- Consent: Granted\n`;
    }
    
    if (data.placeId) {
      notes += `- Google Place ID: ${data.placeId}\n`;
    }
    
    if (data.leadId) {
      notes += `- Lead ID: ${data.leadId}\n`;
    }
    
    // Prepare contact data for Go High Level
    const contactData = {
      name: 'Property Lead', // Will be updated when full info is provided
      phone: phone,
      address1: data.address || '',
      locationId: process.env.GO_HIGH_LEVEL_LOCATION_ID,
      source: 'Website Lead Form',
      
      // Map fields directly to Go High Level custom fields
      customField: {
        // Use the provided custom field keys from Go High Level
        "ppc_address": data.address || '',
        // Additional fields will be added in the complete submission
      },
      
      tags: ['Website Lead', 'Partial Lead'],
      notes: notes,
      customData: {
        leadId: data.leadId,
        submissionType: 'partial',
        timestamp: new Date().toISOString()
      }
    };

    // Send to Go High Level API
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GO_HIGH_LEVEL_API_KEY}`
      },
      body: JSON.stringify(contactData)
    });

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
 * API Route for saving initial lead data (address and phone)
 * Called when user clicks first "Get Cash Offer" button
 */
export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Log incoming request
    console.log('Received partial form submission request');

    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    
    // Apply rate limiting
    const rateLimitResult = await rateLimit(ip);
    if (!rateLimitResult.success) {
      console.log('Rate limit exceeded for IP:', ip);
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Parse and validate request data
    let data;
    try {
      data = await request.json();
      console.log('Received form data:', {
        hasAddress: !!data.address,
        hasPhone: !!data.phone,
        phone: data.phone
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    if (!validatePartialData(data)) {
      console.error('Invalid form data:', data);
      return NextResponse.json(
        { error: 'Invalid partial form data - Missing required fields or invalid format' },
        { status: 400 }
      );
    }

    // Prepare data with timestamp and tracking
    const leadData: Partial<LeadFormData> = {
      ...data,
      timestamp,
      lastUpdated: timestamp,
      leadId,
      submissionType: 'partial'
    };

    console.log('Prepared lead data:', {
      leadId,
      timestamp,
      submissionType: 'partial'
    });

    // Send to Go High Level API
    try {
      const result = await sendToGoHighLevel(leadData);
      console.log('Successfully sent to Go High Level API');
      
      return NextResponse.json({ 
        success: true,
        leadId,
        contactId: result.id // Store the contact ID from Go High Level for later updates
      });
    } catch (error) {
      console.error('Failed to send to Go High Level:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error submitting partial form:', error);
    // Return a specific error message
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