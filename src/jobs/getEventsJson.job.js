// Import required packages
const { GoogleGenAI } = require("@google/genai");
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

global.fetch = require('node-fetch');
global.Headers = fetch.Headers;

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

// Only events from 48 hours from now.
/**
 * Fetch HTML for individual event cards for the next 48 hours from TerpLink
 * @returns {Promise<Array<string>>} 
 */
async function getEventCardsHtml() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  
  try {
    const today = new Date();
    const in48Hours = new Date(today);
    in48Hours.setHours(today.getHours() + 48);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const todayFormatted = formatDate(today);
    const endDateFormatted = formatDate(in48Hours);
    
    console.log(`Getting events from ${todayFormatted} to ${endDateFormatted} (next 48 hours)`);    
    const url = `https://terplink.umd.edu/events?startDate=${todayFormatted}&endDate=${endDateFormatted}`;
    console.log(`Navigating to: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle'
    });
    
    let cardsExist = true;
    try {
      await page.waitForSelector('div.MuiPaper-root.MuiCard-root, a[href^="/event/"]', { 
        state: 'visible',
        timeout: 10000 
      });
    } catch (timeoutError) {
      console.log('No event cards found in the 48-hour window. This might be normal.');
      cardsExist = false;
    }
    
    if (!cardsExist) {
      await browser.close();
      return [];
    }
        
    console.log('Extracting HTML for each event card...');
    const eventCardsHtml = await page.evaluate(() => {
      let cards = [];
      
      const cardElements = document.querySelectorAll('div.MuiPaper-root.MuiCard-root');
      if (cardElements && cardElements.length > 0) {
        console.log(`Found ${cardElements.length} cards with MuiCard-root selector`);
        cards = Array.from(cardElements).map(card => card.outerHTML);
      }
      
      if (cards.length === 0) {
        const eventLinks = document.querySelectorAll('a[href^="/event/"]');
        if (eventLinks && eventLinks.length > 0) {
          console.log(`Found ${eventLinks.length} event links`);
          cards = Array.from(eventLinks).map(link => {
            const cardContainer = link.closest('div[style*="box-sizing: border-box"]') || 
                                link.parentElement?.parentElement;
            return cardContainer ? cardContainer.outerHTML : link.outerHTML;
          });
        }
      }
      
      if (cards.length === 0) {
        const possibleCards = document.querySelectorAll('div[style*="padding: 10px"], div[style*="width: 50%"]');
        if (possibleCards && possibleCards.length > 0) {
          console.log(`Found ${possibleCards.length} possible card containers`);
          cards = Array.from(possibleCards).map(card => card.outerHTML);
        }
      }
      
      return cards;
    });
    
    console.log(`Found ${eventCardsHtml.length} event cards in the next 48 hours`);
    
    if (eventCardsHtml.length > 0) {
      const sampleHtml = eventCardsHtml[0];
      const truncatedSample = sampleHtml.length > 200 ? 
        sampleHtml.substring(0, 200) + '...' : 
        sampleHtml;
      console.log('Sample event card HTML:', truncatedSample);
    }
    
    await browser.close();
    return eventCardsHtml;
  } catch (error) {
    console.error('Error fetching event cards:', error);
    await browser.close();
    throw error;
  }
}

/**
 * Helper function to scroll down the page to load all dynamic content
 * @param {Page} page
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  
  await page.waitForTimeout(1000);
}

/**
 * Convert HTML to structured JSON using Gemini API
 * @param {string} html 
 * @returns {Promise<object>} 
 */
async function convertHtmlToJson(html) {
  console.log('Processing event card HTML with Gemini API...');
  
  const truncatedHtml = html.length > 40000 ? 
    html.substring(0, 40000) + '...' : 
    html;
  
  const prompt = `
  You are a data extraction expert. Your task is to extract event information from HTML event cards from TerpLink (University of Maryland).
  
  The input contains ${html.includes('<!-- NEXT EVENT CARD -->') ? html.split('<!-- NEXT EVENT CARD -->').length : 1} event cards.
  
  IMPORTANT: Extract EACH event card as a separate JSON object. Don't skip any events.
  
  For each card, extract these fields:
  - title: Event title (text inside h3 tags)
  - date: Event date in YYYY-MM-DD format if possible
  - time: Event time
  - location: Event location (often after a location icon)
  - description: Brief description if available (may be empty)
  - organizerName: Organization name (often at the bottom of card)
  - category: Event category if available (may be empty)
  - imageUrl: URL in background-image style attribute if present
  
  OUTPUT FORMAT: A JSON array of event objects ONLY, no additional text:
  [
    {
      "title": "Event Title",
      "date": "YYYY-MM-DD",
      "time": "Time",
      "location": "Location",
      "description": "Description",
      "organizerName": "Organizer",
      "category": "Category",
      "imageUrl": "ImageURL"
    },
    {...}
  ]
  
  HTML content:
  ${truncatedHtml}
  `;
  
  try {
    console.log('Sending request to Gemini API...');    
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      generationConfig: {
        temperature: 0.1, 
        maxOutputTokens: 8192,
        topK: 40,
        topP: 0.95
      }
    });
    
    const responseText = result.response?.text || '';
    console.log('Rep code 200 from Gemini API');    
    const previewLength = Math.min(500, responseText.length);
    console.log(`Response preview (${previewLength} of ${responseText.length} chars):`);
    console.log(responseText.substring(0, previewLength) + (responseText.length > previewLength ? '...' : ''));    
    let eventsData = [];
    let cleanedResponse = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/^\s*\[\s*\n/gm, '[') 
      .replace(/\s*\]\s*$/gm, ']')  
      .trim();
      
    console.log('Cleaned response preview:', cleanedResponse.substring(0, 100) + '...');
    
    try {
      eventsData = JSON.parse(cleanedResponse);
      console.log('✓ Successfully parsed complete response as JSON');
    } catch (parseError) {
      console.log('Could not parse entire response, trying extraction methods...', parseError.message);
      const jsonArrayMatch = cleanedResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/m);
      if (jsonArrayMatch) {
        try {
          eventsData = JSON.parse(jsonArrayMatch[0]);
          console.log('✓ Successfully extracted JSON array using regex');
        } catch (arrayError) {
          console.log('Could not parse extracted array:', arrayError.message);
        }
      }
      
      if (eventsData.length === 0) {
        const objectRegex = /\{[\s\S]*?"title"[\s\S]*?\}/g;
        const objectMatches = cleanedResponse.match(objectRegex);
        
        if (objectMatches && objectMatches.length > 0) {
          const validObjects = [];
          
          for (const objString of objectMatches) {
            try {
              const fixedString = objString
                .replace(/,\s*\}/g, '}') 
                .replace(/(['"])\s*:\s*/g, '$1:') 
                .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":'); 
                
              const obj = JSON.parse(fixedString);
              if (obj.title) { 
                validObjects.push(obj);
              }
            } catch (objError) {
            }
          }
          
          if (validObjects.length > 0) {
            eventsData = validObjects;
            console.log(`✓ Extracted ${validObjects.length} individual JSON objects`);
          }
        }
      }
      
      if (eventsData.length === 0) {
        console.log('⚠️ Using direct HTML extraction as fallback...');
        eventsData = extractEventsDirectlyFromHtml(html);
      }
    }
    
    if (!Array.isArray(eventsData)) {
      console.log('Converting single object to array');
      eventsData = eventsData ? [eventsData] : [];
    }
    
    eventsData = eventsData.filter(event => !!event && !!event.title);
    
    console.log(`Successfully extracted ${eventsData.length} events from the response`);
    return eventsData;
  } catch (error) {
    console.error('Error processing with Gemini API:', error);
    throw new Error(`Failed to process data from Gemini API: ${error.message}`);
  }
}

/**
 * Save JSON data to a file
 * @param {object} data 
 * @param {string} filePath 
 */
async function saveJsonToFile(data, filePath) {
  try {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`JSON saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving JSON:', error);
    throw error;
  }
}

/**
 * Manually extract events from HTML as a fallback method
 * @param {string} html 
 * @returns {Array<Object>} 
 */
function extractEventsDirectlyFromHtml(html) {
  console.log('Attempting direct HTML extraction as fallback...');
  const events = [];
  
  const eventHtmls = html.includes('<!-- NEXT EVENT CARD -->') ?
    html.split('<!-- NEXT EVENT CARD -->') :
    [html]; 
  
  for (const eventHtml of eventHtmls) {
    if (!eventHtml.trim()) continue;
    
    const titleMatch = eventHtml.match(/<h3[^>]*>([^<]+)<\/h3>/i) ||
                      eventHtml.match(/h3 style=[^>]*>([^<]+)<\/h3>/i) ||
                      eventHtml.match(/style="font-size: 1\.06rem;[^>]*>([^<]+)<\/h3>/i);
                      
    const dateTimeMatch = eventHtml.match(/calendar[^>]*>[^<]*<\/svg>([^<]+)/i) ||
                         eventHtml.match(/date[^>]*>([^<]+)<\/div>/i);
                         
    const locationMatch = eventHtml.match(/location[^>]*>[^<]*<\/svg>([^<]+)/i) ||
                         eventHtml.match(/location[^>]*>([^<]+)<\/div>/i);
                         
    const organizerMatch = eventHtml.match(/alt="([^"]+)"[^>]*size="40"/i) ||
                          eventHtml.match(/span style="width: 91%[^>]*>([^<]+)<\/span>/i);
                          
    const imageUrlMatch = eventHtml.match(/background-image: url\(&quot;([^&]+)&quot;\)/i) ||
                         eventHtml.match(/background-image: url\("([^"]+)"\)/i);
    
    let date = '';
    let time = '';
    if (dateTimeMatch && dateTimeMatch[1]) {
      const dateTimeParts = dateTimeMatch[1].trim().split(' at ');
      if (dateTimeParts.length > 0) {
        const dateText = dateTimeParts[0].trim();
        try {
          const dateObj = new Date(dateText);
          if (!isNaN(dateObj.getTime())) {
            date = dateObj.toISOString().split('T')[0]; 
          } else {
            date = dateText; 
          }
        } catch (e) {
          date = dateText;
        }
        
        if (dateTimeParts.length > 1) {
          time = dateTimeParts[1].trim();
        }
      }
    }
    
    const event = {
      title: titleMatch ? titleMatch[1].trim() : "Untitled Event",
      date: date || new Date().toISOString().split('T')[0],
      time: time || "",
      location: locationMatch ? locationMatch[1].trim() : "College Park, Maryland",
      description: "Event details extracted from TerpLink",
      organizerName: organizerMatch ? organizerMatch[1].trim() : "",
      category: "",
      imageUrl: imageUrlMatch ? imageUrlMatch[1] : ""
    };
    
    events.push(event);
  }
  
  console.log(`Manually extracted ${events.length} events from HTML`);
  return events;
}

/**
 * Main func
 */
async function main() {
  try {
    const eventCardsHtml = await getEventCardsHtml();
    
    if (eventCardsHtml.length === 0) {
      console.error('No event cards found on the page');
      return;
    }
    
    console.log(`Processing ${eventCardsHtml.length} event cards with Gemini API...`);    
    const batchSize = 3; 
    const batches = [];
    
    for (let i = 0; i < eventCardsHtml.length; i += batchSize) {
      batches.push(eventCardsHtml.slice(i, i + batchSize));
    }
    
    console.log(`Split into ${batches.length} batches for processing`);    
    let allEvents = [];
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i+1} of ${batches.length}...`);
      
      const batchHtml = batches[i].join('\n\n<!-- NEXT EVENT CARD -->\n\n');      
      const batchEvents = await convertHtmlToJson(batchHtml);
      allEvents = [...allEvents, ...batchEvents];
      
      console.log(`Batch ${i+1} complete, extracted ${batchEvents.length} events`);      
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    if (allEvents.length < eventCardsHtml.length * 0.5) {
      console.log(`WARNING: Only extracted ${allEvents.length} events from ${eventCardsHtml.length} cards.`);
      console.log('Attempting direct HTML extraction as a fallback...');      
      const directHtml = eventCardsHtml.join('\n\n<!-- NEXT EVENT CARD -->\n\n');
      const directEvents = extractEventsDirectlyFromHtml(directHtml);      
      if (directEvents.length > allEvents.length) {
        console.log(`Direct extraction found ${directEvents.length} events vs. ${allEvents.length} from Gemini.`);
        console.log('Using the direct extraction results which found more events.');
        allEvents = directEvents;
      }
    }
    
    // Remove duplicates by title
    const uniqueEvents = [];
    const titles = new Set();
    for (const event of allEvents) {
      if (event.title && !titles.has(event.title)) {
        titles.add(event.title);
        uniqueEvents.push(event);
      }
    }
    
    console.log(`Successfully extracted ${uniqueEvents.length} unique events from ${eventCardsHtml.length} cards`);    
    const outputPath = path.resolve(__dirname, '../../events/events.json');
    await saveJsonToFile(uniqueEvents, outputPath);
    
    console.log('Process completed successfully');
  } catch (error) {
    console.error("Error in main process:", error);
  }
}

main();
