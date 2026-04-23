"""
Voting/Poll App - Backend Server
Flask REST API for creating and voting on polls.
"""

import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

# ---------------------------------------------------------------------------
# In-memory "database"
#   Each poll:
#   {
#       "id": str,
#       "question": str,
#       "options": [{"text": str, "votes": int}],
#       "createdAt": str (ISO timestamp),
#       "voters": set[str]   # set of IPs that have voted (in-memory only)
#   }
# ---------------------------------------------------------------------------
db = {"polls": []}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def find_poll(poll_id):
    """Return poll dict by id, or None."""
    for poll in db["polls"]:
        if poll["id"] == poll_id:
            return poll
    return None


def serialize_poll(poll):
    """Build the JSON-safe response for a poll, including percentages."""
    total_votes = sum(opt["votes"] for opt in poll["options"])
    results = []
    for opt in poll["options"]:
        percentage = (opt["votes"] / total_votes * 100) if total_votes > 0 else 0
        results.append(
            {
                "text": opt["text"],
                "votes": opt["votes"],
                "percentage": round(percentage, 1),
            }
        )
    return {
        "id": poll["id"],
        "question": poll["question"],
        "options": results,
        "totalVotes": total_votes,
        "createdAt": poll["createdAt"],
    }


def get_client_ip():
    """Get the client's IP address for duplicate-vote tracking."""
    # Respect proxy header if present, otherwise use remote_addr
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr or "unknown"


# ---------------------------------------------------------------------------
# Routes — Frontend
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Serve the frontend."""
    return send_from_directory(app.static_folder, "index.html")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------
@app.route("/polls", methods=["GET"])
def get_all_polls():
    """GET /polls — return all polls with vote counts and percentages."""
    polls = [serialize_poll(p) for p in db["polls"]]
    # newest first
    polls.sort(key=lambda p: p["createdAt"], reverse=True)
    return jsonify(polls), 200


@app.route("/polls", methods=["POST"])
def create_poll():
    """POST /polls — create a new poll.

    Body: { "question": str, "options": [str, str, ...] }
    """
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    raw_options = data.get("options") or []

    # --- Validation ---
    if not question:
        return jsonify({"error": "Question is required."}), 400

    if len(question) > 200:
        return jsonify({"error": "Question must be 200 characters or fewer."}), 400

    # Clean options: strip whitespace, remove empties
    options = [str(o).strip() for o in raw_options if str(o).strip()]

    if len(options) < 2:
        return jsonify({"error": "A poll must have at least 2 options."}), 400

    if len(options) > 4:
        return jsonify({"error": "A poll can have at most 4 options."}), 400

    # Disallow duplicate option text within a poll
    if len(set(o.lower() for o in options)) != len(options):
        return jsonify({"error": "Options must be unique."}), 400

    for opt in options:
        if len(opt) > 100:
            return jsonify({"error": "Each option must be 100 characters or fewer."}), 400

    # --- Create ---
    poll = {
        "id": str(uuid.uuid4()),
        "question": question,
        "options": [{"text": opt, "votes": 0} for opt in options],
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "voters": set(),
    }
    db["polls"].append(poll)

    return jsonify(serialize_poll(poll)), 201


@app.route("/polls/<poll_id>/vote", methods=["POST"])
def vote(poll_id):
    """POST /polls/:id/vote — cast a vote.

    Body: { "optionIndex": int }
    Prevents duplicate voting from the same IP address.
    """
    poll = find_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found."}), 404

    data = request.get_json(silent=True) or {}
    option_index = data.get("optionIndex")

    # Validate optionIndex type and bounds
    if not isinstance(option_index, int) or isinstance(option_index, bool):
        return jsonify({"error": "optionIndex must be an integer."}), 400

    if option_index < 0 or option_index >= len(poll["options"]):
        return jsonify({"error": "Invalid optionIndex."}), 400

    # Prevent duplicate voting (IP-based)
    client_ip = get_client_ip()
    if client_ip in poll["voters"]:
        return jsonify({"error": "You have already voted on this poll."}), 409

    # Record the vote
    poll["options"][option_index]["votes"] += 1
    poll["voters"].add(client_ip)

    return jsonify(serialize_poll(poll)), 200


@app.route("/polls/<poll_id>", methods=["DELETE"])
def delete_poll(poll_id):
    """DELETE /polls/:id — delete a poll."""
    poll = find_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found."}), 404

    db["polls"].remove(poll)
    return jsonify({"message": "Poll deleted successfully.", "id": poll_id}), 200


@app.route("/polls/<poll_id>/results", methods=["GET"])
def get_results(poll_id):
    """GET /polls/:id/results — return { question, results, totalVotes }."""
    poll = find_poll(poll_id)
    if not poll:
        return jsonify({"error": "Poll not found."}), 404

    serialized = serialize_poll(poll)
    return (
        jsonify(
            {
                "question": serialized["question"],
                "results": serialized["options"],
                "totalVotes": serialized["totalVotes"],
            }
        ),
        200,
    )


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Resource not found."}), 404


@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def internal_error(_):
    return jsonify({"error": "Internal server error."}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("  Voting/Poll App — Backend running at http://localhost:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True) 
