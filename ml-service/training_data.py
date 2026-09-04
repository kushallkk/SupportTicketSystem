"""
Small synthetic training set for the category + priority classifiers.

This stands in for historical ticket data — in a real deployment you'd train
on resolved tickets from the database instead. Kept intentionally small and
readable rather than sourcing a large external dataset.
"""

# (text, category, priority)
EXAMPLES: list[tuple[str, str, str]] = [
    # billing
    ("I was charged twice for my subscription this month", "billing", "HIGH"),
    ("My invoice shows the wrong amount, please correct it", "billing", "MEDIUM"),
    ("How do I update my credit card on file", "billing", "LOW"),
    ("I want a refund for last month's charge, it was a mistake", "billing", "MEDIUM"),
    ("Payment failed but you still charged my card", "billing", "HIGH"),
    ("Can you send me a copy of my receipt from last week", "billing", "LOW"),
    ("Why did my subscription price increase without notice", "billing", "MEDIUM"),
    ("I need to downgrade my plan to the free tier", "billing", "LOW"),
    ("My card was declined during checkout, I don't know why", "billing", "MEDIUM"),
    ("URGENT: unauthorized charge on my account, this looks like fraud", "billing", "CRITICAL"),
    ("Where can I find my billing history", "billing", "LOW"),
    ("The coupon code isn't applying at checkout", "billing", "LOW"),
    # technical
    ("The app crashes every time I open the settings page", "technical", "HIGH"),
    ("I'm getting a 500 error when I try to upload a file", "technical", "HIGH"),
    ("Dark mode toggle doesn't save my preference after refresh", "technical", "LOW"),
    ("The dashboard is loading extremely slowly today", "technical", "MEDIUM"),
    ("API requests are returning 429 rate limit errors constantly", "technical", "HIGH"),
    ("Production is down, nothing is loading, this is critical", "technical", "CRITICAL"),
    ("Search results are not matching what I typed", "technical", "LOW"),
    ("Getting a blank white screen after login on mobile", "technical", "HIGH"),
    ("Export to CSV is missing the last column of data", "technical", "MEDIUM"),
    ("Notifications aren't showing up even though they're enabled", "technical", "MEDIUM"),
    ("The website is completely unreachable, server seems down", "technical", "CRITICAL"),
    ("Minor UI glitch, button text overflows on small screens", "technical", "LOW"),
    # account
    ("I can't reset my password, the email never arrives", "account", "HIGH"),
    ("Please help me change the email associated with my account", "account", "MEDIUM"),
    ("I'm locked out of my account after too many login attempts", "account", "HIGH"),
    ("How do I enable two-factor authentication", "account", "LOW"),
    ("I want to delete my account and all my data permanently", "account", "MEDIUM"),
    ("My account got suspended and I don't know why, please look into it", "account", "CRITICAL"),
    ("Can I merge two accounts I accidentally created", "account", "LOW"),
    ("Someone else logged into my account, I think I was hacked", "account", "CRITICAL"),
    ("How do I update my display name and profile photo", "account", "LOW"),
    ("I never received the verification email to activate my account", "account", "MEDIUM"),
    ("Need to transfer account ownership to a colleague", "account", "MEDIUM"),
    ("Two-factor codes aren't arriving on my phone", "account", "HIGH"),
    # feature_request
    ("It would be great if you added dark mode scheduling", "feature_request", "LOW"),
    ("Please add support for exporting reports as PDF", "feature_request", "LOW"),
    ("Can you build an integration with Slack for notifications", "feature_request", "LOW"),
    ("Would love keyboard shortcuts for common actions", "feature_request", "LOW"),
    ("Requesting bulk edit support for tickets", "feature_request", "MEDIUM"),
    ("A public API would really help our workflow", "feature_request", "LOW"),
    ("Suggestion: let us customize the dashboard layout", "feature_request", "LOW"),
    ("Please consider adding multi-language support", "feature_request", "LOW"),
    ("Can we get a mobile app, the website is hard to use on phones", "feature_request", "MEDIUM"),
    ("Feature idea: recurring tickets for routine maintenance", "feature_request", "LOW"),
    # other
    ("Just wanted to say the new update looks great, thanks team", "other", "LOW"),
    ("What are your support hours on weekends", "other", "LOW"),
    ("Do you offer discounts for students or nonprofits", "other", "LOW"),
    ("How do I contact your legal team about a partnership", "other", "LOW"),
    ("Is there a changelog somewhere I can follow", "other", "LOW"),
    ("General question about your data retention policy", "other", "MEDIUM"),
    ("Where can I find your terms of service", "other", "LOW"),
    ("Just testing to see how fast support responds", "other", "LOW"),
]

CATEGORIES = sorted({c for _, c, _ in EXAMPLES})
PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
