from playwright.sync_api import sync_playwright
import os

output_dir = r'd:\USE\save\code\αbase\docs\superpowers\plans'
screenshot_path = os.path.join(output_dir, 'phase1-screenshot.png')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Navigate to the app
    page.goto('http://localhost:5174/')
    page.wait_for_load_state('networkidle')
    
    # Take screenshot
    page.screenshot(path=screenshot_path, full_page=True)
    print(f'Screenshot saved to: {screenshot_path}')
    
    # Check for console errors
    console_messages = []
    page.on('console', lambda msg: console_messages.append(f'{msg.type}: {msg.text}'))
    
    # Wait a bit to capture any console messages
    page.wait_for_timeout(1000)
    
    # Check if the app loaded without errors
    errors = [msg for msg in console_messages if 'error' in msg.lower()]
    if errors:
        print(f'Console errors found: {errors}')
    else:
        print('No console errors found')
    
    # Verify the store is working by checking localStorage
    storage = page.evaluate('() => localStorage.getItem("hepta-library-store")')
    print(f'localStorage hepta-library-store: {storage}')
    
    browser.close()
