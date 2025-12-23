# ai-mock-interview-system

## Overview
AI Mock Interview System is a full-stack web application that simulates technical mock interviews using an AI model.
The system dynamically generates interview questions and evaluates user responses to provide feedback, helping users
practice interview scenarios.

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: SQL
- AI Integration: Perplexity API

## Features
- AI-driven interview question generation
- User response evaluation using AI
- Interview data storage using SQL database
- RESTful backend APIs
- Secure handling of API keys using environment variables

## Project Architecture
- Frontend handles user interaction and interview flow
- Backend manages API requests, AI integration, and database operations
- AI responses are processed and returned to the frontend via REST APIs

## Setup Instructions
1. Clone the repository:
   git clone https://github.com/ArunGudla729/ai-mock-interview-system.git
2. Install dependencies:
   npm install
3. Create a `.env` file in the root directory and add:
   PERPLEXITY_API_KEY=your_api_key_here
4. Start the server:
   npm start
5. Open the frontend files in a browser.

## Notes
- This project runs locally because it uses a paid AI API.
- API keys are not included for security reasons.

## Learning Outcomes
- Gained hands-on experience with full-stack development
- Integrated AI APIs into a real-world application
- Improved backend design and API development skills
- Learned secure credential management using environment variables

