document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loadingDiv = document.getElementById("loading");

  function setLoading(isLoading) {
    if (!loadingDiv) return;
    if (isLoading) {
      loadingDiv.classList.remove("hidden");
    } else {
      loadingDiv.classList.add("hidden");
    }
  }

  // Fetch helper with timeout to avoid hanging UI
  async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      setLoading(true);
      const noCacheUrl = `/activities?t=${Date.now()}`;
      const response = await fetchWithTimeout(noCacheUrl, { cache: "no-store" });
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      // Preserve selection, then reset and repopulate activity dropdown
      const prevSelection = activitySelect.value;
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participants = Array.isArray(details.participants) ? details.participants : [];

        const participantsHTML =
          participants.length > 0
            ? `<ul class="participants-list">${participants
                .map(
                  (p) =>
                    `<li class="participant-item"><span class="participant-email">${p}</span><button class="participant-delete" data-activity="${name}" data-email="${p}" title="Unregister ${p}" aria-label="Unregister ${p}"><span class="icon-trash" aria-hidden="true">🗑️</span></button></li>`
                )
                .join("")}</ul>`
            : `<p class="participants-empty">No participants yet.</p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <div class="participants-title">
              <span>Participants</span>
              <span class="participants-count-badge">${participants.length}</span>
            </div>
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Restore selection if still present
      if (prevSelection && activities[prevSelection]) {
        activitySelect.value = prevSelection;
      }
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      setLoading(true);
      const response = await fetchWithTimeout(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        },
        10000
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh activities so the new participant and counts show up
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    } finally {
      setLoading(false);
    }
  });

  // Handle unregister click (event delegation)
  activitiesList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const deleteBtn = target.closest(".participant-delete");
    if (deleteBtn) {
      const activity = deleteBtn.getAttribute("data-activity") || "";
      const email = deleteBtn.getAttribute("data-email") || "";
      if (!activity || !email) return;

      try {
        setLoading(true);
        const response = await fetchWithTimeout(
          `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
          { method: "POST" },
          10000
        );
        const result = await response.json();

        if (response.ok) {
          messageDiv.textContent = result.message || "Participant removed";
          messageDiv.className = "success";
          // Refresh activities to reflect changes
          await fetchActivities();
        } else {
          messageDiv.textContent = result.detail || "Failed to remove participant";
          messageDiv.className = "error";
        }

        messageDiv.classList.remove("hidden");
        setTimeout(() => messageDiv.classList.add("hidden"), 4000);
      } catch (err) {
        console.error("Error unregistering:", err);
        messageDiv.textContent = "Failed to remove participant. Please try again.";
        messageDiv.className = "error";
        messageDiv.classList.remove("hidden");
        setTimeout(() => messageDiv.classList.add("hidden"), 4000);
      } finally {
        setLoading(false);
      }
    }
  });

  // Initialize app
  fetchActivities();
});
