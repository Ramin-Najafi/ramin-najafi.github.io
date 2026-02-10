/*
 * cypress/e2e/linen-part2.cy.js
 *
 * Tests for Linen v1.0.2 [beta] - Part 2: Crisis Support, Quick Capture, Emoji Awareness
 */

const HAPPY_EMOJI = String.fromCodePoint(0x1F60A); // emoji: smiling face
const SAD_EMOJI = String.fromCodePoint(0x1F622); // emoji: crying face
const PARTY_EMOJI = String.fromCodePoint(0x1F389); // emoji: party popper
const GRIN_EMOJI = String.fromCodePoint(0x1F603); // emoji: grinning face
const LAUGH_EMOJI = String.fromCodePoint(0x1F604); // emoji: laughing face

describe('Linen - Crisis Support, Quick Capture, Emoji Awareness', () => {

    const TEST_API_KEY = 'fake-test-api-key-12345';

    beforeEach(() => {
        // Mock all Gemini API calls
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: {
                candidates: [{ content: { parts: [{ text: 'Hey there! I\'m Linen.' }] } }]
            }
        }).as('geminiCall');

        cy.visit('/', {
            onBeforeLoad(win) {
                win.localStorage.setItem('linen-pitch-shown', 'true');
            }
        });

        // Handle onboarding if it appears (first test only, since IDB persists)
        cy.wait(500);
        cy.document().then((doc) => {
            const overlay = doc.getElementById('onboarding-overlay');
            if (overlay && getComputedStyle(overlay).display !== 'none') {
                cy.get('#get-started').click();
                cy.get('#onboarding-api-key').type(TEST_API_KEY);
                cy.get('#save-onboarding-api-key').click();
                cy.wait('@geminiCall', { timeout: 10000 });
                cy.get('#finish-onboarding', { timeout: 10000 }).click();
            }
        });

        // Wait for chat area to be visible and an assistant message to appear (app ready)
        cy.get('#chat-input-area', { timeout: 15000 }).should('be.visible');
        cy.get('.assistant-message', { timeout: 15000 }).should('exist');
    });

    it('Test 1: Crisis modal appears for crisis keywords', () => {
        cy.get('#chat-input').type('I want to die');
        cy.get('#chat-send').click();
        cy.get('#crisis-modal').should('be.visible');
        cy.get('#crisis-modal h2').should('contain', "You're Not Alone");
        cy.get('#close-crisis-modal').click();
        cy.get('#crisis-modal').should('not.be.visible');
    });

    it('Test 2: Crisis modal closes on acknowledge button', () => {
        cy.get('#chat-input').type('I am feeling suicidal');
        cy.get('#chat-send').click();
        cy.get('#crisis-modal').should('be.visible');
        cy.get('#acknowledge-crisis').click();
        cy.get('#crisis-modal').should('not.be.visible');
        cy.get('#toast').should('contain', "I'm here to listen");
    });

    it('Test 3: Non-crisis messages do not trigger crisis modal', () => {
        cy.get('#chat-input').type('Hello, how are you?');
        cy.get('#chat-send').click();
        cy.get('#crisis-modal').should('not.be.visible');
    });

    it('Test 4: Happy emojis are filtered when user is distressed', () => {
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'I understand. Here to help! ' + HAPPY_EMOJI }] } }] }
        }).as('chatResponse');
        cy.get('#chat-input').type('I feel so sad');
        cy.get('#chat-send').click();
        cy.wait('@chatResponse', { timeout: 10000 });
        cy.get('.assistant-message').last().should('not.contain', HAPPY_EMOJI);
    });

    it('Test 5: Happy emojis are NOT filtered when user is positive', () => {
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'That is great! ' + HAPPY_EMOJI }] } }] }
        }).as('chatResponse');
        cy.get('#chat-input').type('I feel so happy');
        cy.get('#chat-send').click();
        cy.wait('@chatResponse', { timeout: 10000 });
        cy.get('.assistant-message').last().should('contain', HAPPY_EMOJI);
    });

    it('Test 6: Quick capture modal opens and closes', () => {
        cy.get('#quick-capture-btn').click();
        cy.get('#quick-capture-modal').should('be.visible');
        cy.get('#close-quick-capture').click();
        cy.get('#quick-capture-modal').should('not.be.visible');
    });

    it('Test 7: Quick capture saves a thought as a memory', () => {
        cy.get('#quick-capture-btn').click();
        cy.get('#quick-capture-text').type('This is a quick thought to save.');
        cy.get('#save-quick-capture').click();
        cy.get('#quick-capture-modal').should('not.be.visible');
        cy.get('#toast').should('contain', 'Thought saved!');
        cy.get('#memories-button').click();
        cy.get('.memory-card').should('contain', 'This is a quick thought to save.');
    });

    it('Test 8: Quick capture saves with optional title', () => {
        cy.get('#quick-capture-btn').click();
        cy.get('#quick-capture-title').type('Important Note');
        cy.get('#quick-capture-text').type('Details for the important note.');
        cy.get('#save-quick-capture').click();
        cy.get('#memories-button').click();
        cy.get('.memory-card').should('contain', 'Important Note');
    });

    it('Test 9: Quick capture requires text input', () => {
        cy.get('#quick-capture-btn').click();
        cy.get('#save-quick-capture').click();
        cy.get('#toast').should('contain', 'Please enter something to save.');
        cy.get('#quick-capture-modal').should('be.visible');
    });

    it('Test 10: Mood check modal opens and closes', () => {
        cy.get('#mood-check-btn').click();
        cy.get('#mood-check-modal').should('be.visible');
        cy.get('#close-mood-check').click();
        cy.get('#mood-check-modal').should('not.be.visible');
    });

    it('Test 11: Mood check saves a memory with chosen mood', () => {
        cy.get('#mood-check-btn').click();
        cy.get('.mood-btn').first().click();
        cy.get('#mood-check-modal').should('not.be.visible');
        cy.get('#toast').should('contain', 'Mood saved');
        cy.get('#memories-button').click();
        cy.get('.memory-card').should('contain', 'Mood check-in');
    });

    it('Test 12: Version display is correct', () => {
        cy.get('#settings-button').click();
        cy.get('#version-info').should('contain', 'v1.0.2 [beta]');
    });

    // Integration Tests
    it('Test 13: Full cycle - chat, crisis, quick capture, mood check', () => {
        // Chat
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'I am doing well! How about you?' }] } }] }
        }).as('chat1');
        cy.get('#chat-input').type('Hello Linen, how are you?');
        cy.get('#chat-send').click();
        cy.wait('@chat1', { timeout: 10000 });
        cy.get('.assistant-message').last().should('contain', 'I am doing well!');

        // Crisis
        cy.get('#chat-input').type('I feel like self harm');
        cy.get('#chat-send').click();
        cy.get('#crisis-modal').should('be.visible');
        cy.get('#acknowledge-crisis').click();

        // Quick Capture
        cy.get('#quick-capture-btn').click();
        cy.get('#quick-capture-text').type('Urgent thought.');
        cy.get('#save-quick-capture').click();
        cy.get('#toast').should('contain', 'Thought saved!');

        // Mood Check
        cy.get('#mood-check-btn').click();
        cy.get('.mood-btn').eq(4).click(); // Sad button (5th)
        cy.get('#toast').should('contain', 'Mood saved');

        // Verify memories
        cy.get('#memories-button').click();
        cy.get('#memories-list').should('contain', 'Urgent thought.');
        cy.get('#memories-list').should('contain', 'Mood check-in');
    });

    it('Test 14: Distressed user gets filtered emoji response', () => {
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'I am sorry to hear that. I am here for you. ' + HAPPY_EMOJI }] } }] }
        }).as('chatResponseEmojiFilter');
        cy.get('#chat-input').type('I am feeling really sad and depressed today');
        cy.get('#chat-send').click();
        cy.wait('@chatResponseEmojiFilter', { timeout: 10000 });
        cy.get('.assistant-message').last().should('not.contain', HAPPY_EMOJI);
    });

    it('Test 15: Positive user gets unfiltered emoji response', () => {
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'That is wonderful news! ' + PARTY_EMOJI }] } }] }
        }).as('chatResponseEmojiNoFilter');
        cy.get('#chat-input').type('Today is great, I am so happy');
        cy.get('#chat-send').click();
        cy.wait('@chatResponseEmojiNoFilter', { timeout: 10000 });
        cy.get('.assistant-message').last().should('contain', PARTY_EMOJI);
    });

    it('Test 16: Opening memory modal for a saved memory', () => {
        cy.get('#quick-capture-btn').click();
        cy.get('#quick-capture-text').type('Memory to view in modal.');
        cy.get('#save-quick-capture').click();
        cy.get('#toast').should('contain', 'Thought saved!');
        cy.get('#memories-button').click();
        cy.get('.memory-card').first().click();
        cy.get('#memory-view-modal').should('be.visible');
        cy.get('#memory-view-modal').should('contain', 'Memory to view in modal.');
        cy.get('#close-memory-modal').click();
        cy.get('#memory-view-modal').should('not.be.visible');
    });

    it('Test 17: Editing a memory from the memories panel (alert check)', () => {
        cy.get('#quick-capture-btn').click();
        cy.get('#quick-capture-text').type('Memory to attempt edit.');
        cy.get('#save-quick-capture').click();
        cy.get('#memories-button').click();
        cy.on('window:alert', (str) => {
            expect(str).to.equal('Edit functionality coming soon!');
        });
        cy.get('.memory-card').first().find('.edit-memory').click();
    });

    it('Test 18: Confirming clear chat history clears conversation DB', () => {
        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'Reply 1' }] } }] }
        }).as('chatReply1');
        cy.get('#chat-input').type('Test message 1');
        cy.get('#chat-send').click();
        cy.wait('@chatReply1', { timeout: 10000 });

        cy.intercept('POST', 'https://generativelanguage.googleapis.com/**', {
            statusCode: 200,
            body: { candidates: [{ content: { parts: [{ text: 'Reply 2' }] } }] }
        }).as('chatReply2');
        cy.get('#chat-input').type('Test message 2');
        cy.get('#chat-send').click();
        cy.wait('@chatReply2', { timeout: 10000 });

        cy.on('window:confirm', () => true);
        cy.get('#settings-button').click();
        cy.get('#clear-chat-history').click();
        cy.get('#chat-messages').children().should('have.length.at.most', 1);
    });
});
