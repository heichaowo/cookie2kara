#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'cross-fetch';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

/**
 * Decrypt cookie data from Cookie Cloud
 * @param {string} uuid - Cookie Cloud UUID
 * @param {string} encrypted - Encrypted cookie data
 * @param {string} password - Cookie Cloud password
 * @returns {Object} Decrypted cookie and local storage data
 */
function cookieDecrypt(uuid, encrypted, password) {
  const theKey = CryptoJS.MD5(`${uuid}-${password}`).toString().substring(0, 16);
  const decrypted = CryptoJS.AES.decrypt(encrypted, theKey).toString(CryptoJS.enc.Utf8);
  const parsed = JSON.parse(decrypted);
  return parsed;
}

/**
 * Fetch cookies from Cookie Cloud API
 * @param {string} host - Cookie Cloud host URL
 * @param {string} uuid - Cookie Cloud UUID
 * @param {string} password - Cookie Cloud password
 * @returns {Array} Array of cookie objects
 */
async function fetchCookiesFromCloud(host, uuid, password) {
  try {
    const url = `${host}/get/${uuid}`;
    console.log(`Fetching cookies from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    let cookies = [];

    if (json && json.encrypted) {
      console.log('Decrypting cookie data...');
      const { cookie_data } = cookieDecrypt(uuid, json.encrypted, password);
      
      // Extract cookies from all domains
      for (const domain in cookie_data) {
        const domainCookies = cookie_data[domain];
        if (Array.isArray(domainCookies)) {
          cookies = cookies.concat(domainCookies);
        }
      }
      
      console.log(`Found ${cookies.length} cookies from ${Object.keys(cookie_data).length} domains`);
    } else {
      console.log('No encrypted data found in response');
    }

    return cookies;
  } catch (error) {
    console.error('Error fetching cookies from cloud:', error.message);
    throw error;
  }
}

/**
 * Convert Cookie Cloud format to KaraKeep format
 * @param {Array} cloudCookies - Cookies from Cookie Cloud
 * @returns {Array} Cookies in KaraKeep format
 */
function convertToKaraKeepFormat(cloudCookies) {
  return cloudCookies.map(cookie => {
    const karaKeepCookie = {
      name: cookie.name,
      value: cookie.value
    };

    // Add optional fields if they exist
    if (cookie.domain) {
      karaKeepCookie.domain = cookie.domain;
    }
    
    if (cookie.path) {
      karaKeepCookie.path = cookie.path;
    }
    
    if (cookie.expirationDate) {
      // Convert Chrome's expirationDate to Unix timestamp
      karaKeepCookie.expires = Math.floor(cookie.expirationDate);
    }
    
    if (typeof cookie.httpOnly === 'boolean') {
      karaKeepCookie.httpOnly = cookie.httpOnly;
    }
    
    if (typeof cookie.secure === 'boolean') {
      karaKeepCookie.secure = cookie.secure;
    }
    
    if (cookie.sameSite) {
      // Normalize sameSite values according to mapping table
      let sameSite = cookie.sameSite.toLowerCase();
      
      if (sameSite === 'no_restriction') {
        sameSite = 'None';
      } else if (sameSite === 'lax') {
        sameSite = 'Lax';
      } else if (sameSite === 'unspecified') {
        sameSite = 'Lax';
      } else if (sameSite === 'strict') {
        sameSite = 'Strict';
      } else {
        // Default fallback for any other values
        sameSite = 'Lax';
      }
      
      karaKeepCookie.sameSite = sameSite;
    }

    return karaKeepCookie;
  });
}

/**
 * Save cookies to JSON file
 * @param {Array} cookies - Cookies in KaraKeep format
 * @param {string} outputPath - Output file path
 */
async function saveCookiesToFile(cookies, outputPath) {
  try {
    const jsonContent = JSON.stringify(cookies, null, 2);
    await fs.writeFile(outputPath, jsonContent, 'utf8');
    console.log(`Successfully saved ${cookies.length} cookies to ${outputPath}`);
  } catch (error) {
    console.error('Error saving cookies to file:', error.message);
    throw error;
  }
}

/**
 * Main function to sync cookies from Cookie Cloud to KaraKeep format
 */
async function syncCookies() {
  try {
    console.log('Starting cookie synchronization...');
    
    // Get environment variables
    const host = process.env.COOKIECLOUD_HOST;
    const uuid = process.env.COOKIECLOUD_UUID;
    const password = process.env.COOKIECLOUD_PASSWORD;

    // Validate environment variables
    if (!host || !uuid || !password) {
      throw new Error('Missing required environment variables. Please check your .env file.');
    }

    console.log(`Cookie Cloud Host: ${host}`);
    console.log(`Cookie Cloud UUID: ${uuid}`);

    // Fetch cookies from Cookie Cloud
    const cloudCookies = await fetchCookiesFromCloud(host, uuid, password);
    
    if (cloudCookies.length === 0) {
      console.log('No cookies found in Cookie Cloud');
      return;
    }

    // Convert to KaraKeep format
    console.log('Converting cookies to KaraKeep format...');
    const karaKeepCookies = convertToKaraKeepFormat(cloudCookies);

    // Save to JSON file
    const outputPath = path.join(__dirname, 'cookies.json');
    await saveCookiesToFile(karaKeepCookies, outputPath);

    console.log('Cookie synchronization completed successfully!');
    
  } catch (error) {
    console.error('Cookie synchronization failed:', error.message);
    process.exit(1);
  }
}

/**
 * Set up periodic sync (every 30 minutes by default)
 * @param {number} intervalMinutes - Sync interval in minutes
 */
function setupPeriodicSync(intervalMinutes = 30) {
  console.log(`Setting up periodic sync every ${intervalMinutes} minutes...`);
  
  // Run initial sync
  syncCookies();
  
  // Set up interval
  setInterval(() => {
    console.log('\n--- Periodic Sync ---');
    syncCookies();
  }, intervalMinutes * 60 * 1000);
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--watch') || args.includes('-w')) {
    // Run in watch mode with periodic sync
    const intervalArg = args.find(arg => arg.startsWith('--interval='));
    const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : 30;
    setupPeriodicSync(interval);
  } else {
    // Run once
    syncCookies();
  }
}

export { syncCookies, fetchCookiesFromCloud, convertToKaraKeepFormat };