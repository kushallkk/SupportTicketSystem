import pytest

from public_data import classify_row


@pytest.mark.parametrize(
    "queue, ticket_type, text, expected",
    [
        ("Billing and Payments", "Request", "There is an error on my invoice and I need a refund", "billing"),
        ("Technical Support", "Incident", "The dashboard crashes with an error whenever I open reports", "technical"),
        ("IT Support", "Incident", "Our VPN stopped working after the update", "technical"),
        ("Customer Service", "Incident", "I forgot my password and I'm locked out of my login", "account"),
        ("Customer Service", "Request", "We would like to see a new feature for exporting reports", "feature_request"),
        ("Customer Service", "Request", "Could you tell me about your onboarding programme and training options", "other"),
        ("General Inquiry", "Request", "What are your opening hours over the holidays", "other"),
    ],
)
def test_rows_where_queue_and_wording_agree_are_labelled(queue, ticket_type, text, expected):
    assert classify_row(queue, ticket_type, text) == expected


@pytest.mark.parametrize(
    "queue, ticket_type, text",
    [
        # queue says billing but the text isn't about money: the noise that poisoned the first experiments
        ("Billing and Payments", "Request", "How do I secure medical data on macOS systems"),
        # account wording inside a billing ticket is ambiguous
        ("Billing and Payments", "Incident", "I can't log in to see my invoice"),
        # a technical queue ticket with no technical symptoms
        ("Technical Support", "Request", "Please share the pricing brochure"),
        # feature wording but not a request/change type
        ("Customer Service", "Incident", "would be great if this worked, but it is broken"),
    ],
)
def test_ambiguous_or_contradictory_rows_are_dropped_not_guessed(queue, ticket_type, text):
    assert classify_row(queue, ticket_type, text) is None
