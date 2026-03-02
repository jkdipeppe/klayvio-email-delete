import axios, { AxiosInstance, AxiosResponse } from 'axios';

const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const API_REVISION = '2024-10-15'; // Use latest stable revision

export class KlaviyoClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: KLAVIYO_API_BASE,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'revision': API_REVISION,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  // Get account information
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.client.get('/accounts/');
      return response.data.data[0] || null;
    } catch (error) {
      console.error('Error fetching account info:', error);
      return null;
    }
  }

  // Fetch all profiles with pagination
  async getAllProfiles(): Promise<any[]> {
    const profiles: any[] = [];
    let nextUrl: string | null = '/profiles/';
    
    while (nextUrl) {
      try {
        let response: AxiosResponse<any>;
        
        if (nextUrl.startsWith('http://') || nextUrl.startsWith('https://')) {
          // Full URL from Klaviyo pagination - already includes all query params
          // Make direct request to full URL (bypass baseURL)
          response = await axios.get(nextUrl, {
            headers: {
              'Authorization': this.client.defaults.headers['Authorization'],
              'revision': this.client.defaults.headers['revision'],
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
        } else {
          // First request - add params
          response = await this.client.get(nextUrl, {
            params: {
              'fields[profile]': 'email,first_name,last_name,created,updated',
              'page[size]': 100,
            },
          });
        }
        
        profiles.push(...response.data.data);
        
        // Get next URL - Klaviyo returns full URLs in links.next
        nextUrl = response.data.links?.next || null;
        
        // Respect rate limits
        await this.sleep(100);
      } catch (error: any) {
        console.error('Error fetching profiles:', error.response?.data || error.message);
        break;
      }
    }
    
    return profiles;
  }

  // Get profiles by email filter (exact match only)
  async getProfileByEmail(email: string): Promise<any | null> {
    try {
      const response = await this.client.get('/profiles/', {
        params: {
          filter: `equals(email,"${email}")`,
        },
      });
      
      return response.data.data[0] || null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  // Request profile deletion via Data Privacy API
  async deleteProfile(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post('/data-privacy-deletion-jobs/', {
        data: {
          type: 'data-privacy-deletion-job',
          attributes: {
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: email,
                },
              },
            },
          },
        },
      });
      
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.errors?.[0]?.detail || error.message 
      };
    }
  }

  // Rate limit helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

