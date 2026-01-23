import streamlit as st

st.set_page_config(page_title="AI Teaching Assistant")

st.title("AI Teaching Assistant 🤖")

# Create session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

# Chat input box
user_input = st.chat_input("Type your question here...")

if user_input:
    # Save user message
    st.session_state.messages.append({
        "role": "user",
        "content": user_input
    })

    # Display user message
    with st.chat_message("user"):
        st.write(user_input)

    # Temporary bot reply (no AI yet)
    bot_reply = "I am a simple AI bot. AI logic will be added later."

    # Save bot message
    st.session_state.messages.append({
        "role": "assistant",
        "content": bot_reply
    })

    # Display bot message
    with st.chat_message("assistant"):
        st.write(bot_reply)
