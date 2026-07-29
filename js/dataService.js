// Question Grid — data layer
// Thin wrapper around the Apps Script Web App. Every function here does
// exactly one network call; the rest of the app never talks to the
// network directly, which is what makes the "fetch once at Generate,
// then survive a connection loss" design possible.

const DataService = (() => {

  async function listBanks() {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=listBanks`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Could not reach the question bank service (network error).');
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.banks;
  }

  async function getBank(name) {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=getBank&name=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Could not reach the question bank service (network error).');
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.questions;
  }

  return { listBanks, getBank };
})();
