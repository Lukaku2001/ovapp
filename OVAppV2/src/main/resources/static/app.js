const API_BASE = 'http://localhost:8080/api';

let selectedFrom = null;
let selectedTo = null;
let searchTimeout = null;
let stationAccessibilityData = [];

// initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing...');
    // fetch accessibility data
    fetch('stations_toegankelijkheid.json')
        .then(response => response.json())
        .then(data => {
            stationAccessibilityData = data;
            console.log('Accessibility data loaded:', stationAccessibilityData);
        })
        .catch(error => console.error('Error loading accessibility data:', error));

    initializeDateTimeInputs();
    setupTabSwitching();
    setupAutocomplete('fromInput', 'fromSuggestions');
    setupAutocomplete('toInput', 'toSuggestions');
    setupPlanButton();
});

function initializeDateTimeInputs() {
    const now = new Date();
    document.getElementById('dateInput').valueAsDate = now;
    document.getElementById('timeInput').value = now.toTimeString().slice(0, 5);
}

function setupTabSwitching() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            suggestions.classList.remove('active');
            return;
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchStations(query, suggestions, inputId), 300);
    });

    input.addEventListener('blur', () => {
        setTimeout(() => suggestions.classList.remove('active'), 200);
    });

    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) {
            suggestions.classList.add('active');
        }
    });
}

async function searchStations(query, container, inputId) {
    try {
        const response = await fetch(`${API_BASE}/stations?query=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch stations');
        }
        
        const data = await response.json();
        displayStationSuggestions(data, container, inputId);
    } catch (error) {
        console.error('Error searching stations:', error);
        container.innerHTML = '<div class="suggestion-item"><div class="suggestion-name">Fout bij ophalen stations</div></div>';
    }
}

function displayStationSuggestions(data, container, inputId) {
    container.innerHTML = '';
    
    if (data.payload && data.payload.length > 0) {
        data.payload.slice(0, 8).forEach(station => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div class="suggestion-name">${escapeHtml(station.namen.lang)}</div>
                <div class="suggestion-type">Treinstation \u2022 ${escapeHtml(station.land)}</div>
            `;
            item.addEventListener('click', () => selectStation(station, inputId, container));
            container.appendChild(item);
        });
        container.classList.add('active');
    } else {
        container.innerHTML = '<div class="suggestion-item"><div class="suggestion-name">Geen stations gevonden</div></div>';
        container.classList.add('active');
    }
}

function selectStation(station, inputId, container) {
    const input = document.getElementById(inputId);
    input.value = station.namen.lang;
    
    if (inputId === 'fromInput') {
        selectedFrom = station.code;
    } else {
        selectedTo = station.code;
    }
    
    container.classList.remove('active');
}

function setupPlanButton() {
    document.getElementById('planButton').addEventListener('click', planJourney);
}

async function planJourney() {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = '';

    if (!selectedFrom || !selectedTo) {
        showError('Selecteer een vertrek- en aankomststation');
        return;
    }

    const activeTab = document.querySelector('.tab.active').dataset.tab;
    const dateInput = document.getElementById('dateInput').value;
    const timeInput = document.getElementById('timeInput').value;

    let dateTime = null;
    if (activeTab !== 'now') {
        dateTime = `${dateInput}T${timeInput}:00`;
    }

    const departure = activeTab !== 'arrival';

    showLoading();

    try {
        let url = `${API_BASE}/trips?fromStation=${selectedFrom}&toStation=${selectedTo}&departure=${departure}`;
        if (dateTime) {
            url += `&dateTime=${encodeURIComponent(dateTime)}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch trips');
        }
        
        const data = await response.json();
        await displayResults(data);
    } catch (error) {
        showError('Er ging iets mis bij het ophalen van reisopties');
        console.error('Error fetching trips:', error);
    }
}

function showLoading() {
    const container = document.getElementById('resultsContainer');
    container.className = 'results-panel';
    container.innerHTML = '<div class="loading">Reizen zoeken...</div>';
}

function showError(message) {
    const container = document.getElementById('errorContainer');
    container.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

async function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    
    if (!data.trips || data.trips.length === 0) {
        container.className = 'results-panel';
        container.innerHTML = '<div class="loading">Geen reizen gevonden</div>';
        return;
    }

    container.className = 'results-panel';
    container.innerHTML = '<h2>Reisopties</h2>';

    for (let i = 0; i < data.trips.length; i++) {
        const card = await createJourneyCard(data.trips[i], i);
        container.appendChild(card);
    }
}

async function createJourneyCard(trip, index) {
    const card = document.createElement('div');
    card.className = 'journey-card';
    
    const departure = new Date(trip.legs[0].origin.plannedDateTime);
    const arrival = new Date(trip.legs[trip.legs.length - 1].destination.plannedDateTime);
    const duration = Math.round((arrival - departure) / 60000);
    
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationText = `${hours}u ${minutes}m`;

    const transfers = trip.legs.length - 1;
    
    // Haal de prijs op via de API
    let priceHtml = '';
    try {
        const fromStation = selectedFrom;
        const toStation = selectedTo;
        
        const response = await fetch(`${API_BASE}/price?fromStation=${fromStation}&toStation=${toStation}`);
        
        if (response.ok) {
            const priceData = await response.json();
            
            if (priceData.payload && priceData.payload.totalPriceInCents) {
                const price = (priceData.payload.totalPriceInCents / 100).toFixed(2).replace('.', ',');
                priceHtml = `<div class="journey-price">\u20AC ${price}</div>`;
            }
        }
    } catch (error) {
        console.error('Error fetching price:', error);
    }
    
    card.innerHTML = `
        <div class="journey-header">
            <div>
                <div class="journey-time">${formatTime(departure)} \u2192 ${formatTime(arrival)}</div>
                <div class="journey-duration">${durationText}</div>
            </div>
            ${priceHtml}
        </div>
        
        <div class="journey-icons">
            ${trip.legs.map(leg => `<div class="transport-icon">\uD83D\uDE86</div>`).join('')}
            ${transfers > 0 ? `<div class="transport-icon">\uD83D\uDD04</div>` : ''}
        </div>

        <div class="journey-info">
            <div class="info-item">
                <span class="info-icon">\uD83D\uDD04</span>
                <span>${transfers}x</span>
            </div>
            ${trip.crowdForecast ? `
                <div class="info-item crowding">
                    <span class="info-icon">\uD83D\uDC65</span>
                    <span>${escapeHtml(trip.crowdForecast)}</span>
                </div>
            ` : ''}
        </div>

        <div class="journey-details">
            <div class="loading">Details laden...</div>
        </div>
    `;

    card.addEventListener('click', async (e) => {
        if (!e.target.closest('a')) {
            const isExpanded = card.classList.contains('expanded');
            
            if (!isExpanded) {
                const detailsContainer = card.querySelector('.journey-details');
                detailsContainer.innerHTML = '<div class="loading">Details laden...</div>';
                card.classList.add('expanded');
                
                const timeline = await createTimeline(trip);
                detailsContainer.innerHTML = timeline;
            } else {
                card.classList.remove('expanded');
            }
        }
    });

    return card;
}

function getLiftStatus(stationName) {
    const station = stationAccessibilityData.find(s => s.stationName === stationName);
    return station ? station.hasLift : null; // Returns true, false, or null if not found
}

async function createTimeline(trip) {
    let html = '<div class="timeline">';

    trip.legs.forEach((leg, legIndex) => {
        const depTime = new Date(leg.origin.plannedDateTime);
        const arrTime = new Date(leg.destination.plannedDateTime);
        const depLiftStatus = getLiftStatus(leg.origin.name);
        const arrLiftStatus = getLiftStatus(leg.destination.name);

        // Departure station
        html += `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-time">${formatTime(depTime)}</div>
                <div class="timeline-station">${escapeHtml(leg.origin.name)}</div>
                <div class="timeline-track">Spoor ${escapeHtml(leg.origin.plannedTrack || '?')}</div>
                <div class="timeline-lift lift-${
                    depLiftStatus === true ? 'available' :
                    depLiftStatus === false ? 'unavailable' : 'unknown'
                }">
                    <span class="lift-icon">\uD83D\uDEFD</span>
                    <span class="lift-text">${
                        depLiftStatus === true ? 'Lift beschikbaar' :
                        depLiftStatus === false ? 'Geen lift' : 'Liftstatus onbekend'
                    }</span>
                </div>
            </div>
        `;

        if (leg.product) {
            html += `
                <div class="timeline-transfer">
                    <span class="transfer-icon">\uD83D\uDE86</span>
                    <div class="transfer-info">
                        <div><strong>${escapeHtml(leg.product.displayName)}</strong></div>
                        <div class="timeline-track">Richting ${escapeHtml(leg.direction)}</div>
                    </div>
                </div>
            `;
        }

        if (legIndex < trip.legs.length - 1) {
            const transferTime = Math.round(
                (new Date(trip.legs[legIndex + 1].origin.plannedDateTime) -
                 new Date(leg.destination.plannedDateTime)) / 60000
            );

            html += `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-time">${formatTime(arrTime)}</div>
                    <div class="timeline-station">${escapeHtml(leg.destination.name)}</div>
                    <div class="timeline-track">Spoor ${escapeHtml(leg.destination.plannedTrack || '?')}</div>
                    <div class="timeline-lift lift-${
                        arrLiftStatus === true ? 'available' :
                        arrLiftStatus === false ? 'unavailable' : 'unknown'
                    }">
                        <span class="lift-icon">\uD83D\uDEFD</span>
                        <span class="lift-text">${
                            arrLiftStatus === true ? 'Lift beschikbaar' :
                            arrLiftStatus === false ? 'Geen lift' : 'Liftstatus onbekend'
                        }</span>
                    </div>
                </div>
                <div class="timeline-transfer">
                    <span class="transfer-icon">\uD83D\uDEB6</span>
                    <div class="transfer-info">
                        <div class="transfer-duration">${transferTime} min. overstaptijd</div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-time">${formatTime(arrTime)}</div>
                    <div class="timeline-station">${escapeHtml(leg.destination.name)}</div>
                    <div class="timeline-track">Spoor ${escapeHtml(leg.destination.plannedTrack || '?')}</div>
                    <div class="timeline-lift lift-${
                        arrLiftStatus === true ? 'available' :
                        arrLiftStatus === false ? 'unavailable' : 'unknown'
                    }">
                        <span class="lift-icon">\uD83D\uDEFD</span>
                        <span class="lift-text">${
                            arrLiftStatus === true ? 'Lift beschikbaar' :
                            arrLiftStatus === false ? 'Geen lift' : 'Liftstatus onbekend'
                        }</span>
                    </div>
                </div>
            `;
        }
    });

    html += '</div>';
    return html;
}

function formatTime(date) {
    return date.toTimeString().slice(0, 5);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('ov app initialized successfully');