document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');

    // --- FORM INPUTS ---
    const departureInput = document.getElementById('departure');
    const arrivalInput = document.getElementById('arrival');
    const departureDateInput = document.getElementById('departure-date');
    const returnDateInput = document.getElementById('return-date');
    const passengersInput = document.getElementById('passengers');
    const cabinClassSelect = document.getElementById('cabin-class');

    // --- SORTING & FILTERING ---
    const sortBySelect = document.getElementById('sort-by');
    const filterNonstopCheckbox = document.getElementById('filter-nonstop');

    let allFlights = []; // To store the fetched flights
    let currentSearch = null; // To track current search parameters

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    departureDateInput.min = today;
    returnDateInput.min = today;

    // Update return date minimum when departure date changes
    departureDateInput.addEventListener('change', () => {
        returnDateInput.min = departureDateInput.value;
        if (returnDateInput.value && returnDateInput.value < departureDateInput.value) {
            returnDateInput.value = '';
        }
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        fetchFlights();
    });

    sortBySelect.addEventListener('change', () => {
        applySortingAndFiltering();
    });

    filterNonstopCheckbox.addEventListener('change', () => {
        applySortingAndFiltering();
    });

    async function fetchFlights() {
        showLoading();
        hideError();

        const departureId = departureInput.value.trim();
        const arrivalId = arrivalInput.value.trim();
        const outboundDate = departureDateInput.value;
        const returnDate = returnDateInput.value;
        const passengers = passengersInput.value;
        const cabinClass = cabinClassSelect.value;

        // Store current search for reference
        currentSearch = {
            departure: departureId,
            arrival: arrivalId,
            outboundDate,
            returnDate,
            passengers,
            cabinClass
        };

        // --- IMPORTANT: REPLACE WITH YOUR SERPAPI API KEY ---
        const apiKey = '50e3a9a72b0838304a69d377e9605b905dafe7ba9f63f818d79afee75eaa8755'; // Replace with your actual SerpAPI key

        const travelClassMap = {
            'economy': 1,
            'premium-economy': 2,
            'business': 3,
            'first': 4
        };

        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        let url = `${proxyUrl}https://serpapi.com/search.json?engine=google_flights&api_key=${apiKey}&departure_id=${encodeURIComponent(departureId)}&arrival_id=${encodeURIComponent(arrivalId)}&outbound_date=${outboundDate}&adults=${passengers}&travel_class=${travelClassMap[cabinClass]}`;

        if (returnDate) {
            url += `&return_date=${returnDate}&type=1`;
        } else {
            url += `&type=2`;
        }

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Combine best and other flights
            allFlights = [...(data.best_flights || []), ...(data.other_flights || [])];
            
            if (allFlights.length === 0) {
                showNoResults();
            } else {
                applySortingAndFiltering();
            }

        } catch (error) {
            console.error('Fetch error:', error);
            showError(`Failed to fetch flights: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    function applySortingAndFiltering() {
        let flightsToDisplay = [...allFlights];

        // Filtering
        if (filterNonstopCheckbox.checked) {
            flightsToDisplay = flightsToDisplay.filter(flight => !flight.layovers || flight.layovers.length === 0);
        }

        // Sorting
        const sortBy = sortBySelect.value;
        if (sortBy === 'price') {
            flightsToDisplay.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'duration') {
            flightsToDisplay.sort((a, b) => a.total_duration - b.total_duration);
        } else if (sortBy === 'departure-time') {
            flightsToDisplay.sort((a, b) => {
                const timeA = a.flights?.[0]?.departure_airport?.time || '00:00';
                const timeB = b.flights?.[0]?.departure_airport?.time || '00:00';
                return timeA.localeCompare(timeB);
            });
        } else if (sortBy === 'arrival-time') {
            flightsToDisplay.sort((a, b) => {
                const timeA = a.flights?.[a.flights.length - 1]?.arrival_airport?.time || '00:00';
                const timeB = b.flights?.[b.flights.length - 1]?.arrival_airport?.time || '00:00';
                return timeA.localeCompare(timeB);
            });
        }

        renderFlights(flightsToDisplay);
    }

    function formatDuration(minutes) {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }

    function formatLayovers(layovers) {
        if (!layovers || layovers.length === 0) return 'Nonstop';
        if (layovers.length === 1) return '1 stop';
        return `${layovers.length} stops`;
    }

    function renderFlights(flights) {
        resultsContainer.innerHTML = '';
        
        if (!flights || flights.length === 0) {
            showNoResults();
            return;
        }

        const cheapestFlightPrice = Math.min(...flights.filter(f => f.price).map(f => f.price));

        flights.forEach(flight => {
            const flightCard = document.createElement('div');
            flightCard.classList.add('flight-card');

            if (flight.price && flight.price === cheapestFlightPrice) {
                flightCard.classList.add('cheapest');
            }

            const departureAirport = flight.flights?.[0]?.departure_airport?.id || 'N/A';
            const arrivalAirport = flight.flights?.[flight.flights.length - 1]?.arrival_airport?.id || 'N/A';
            
            let flightDetailsHtml = '';
            flight.flights.forEach((leg, index) => {
                flightDetailsHtml += `
                    <div class="flight-leg">
                        <img src="${leg.airline_logo}" alt="${leg.airline} logo" class="airline-logo-small">
                        <span>${leg.departure_airport.id} → ${leg.arrival_airport.id}</span>
                        <span>${leg.departure_airport.time} - ${leg.arrival_airport.time}</span>
                        <span>${leg.airline} ${leg.flight_number}</span>
                    </div>
                `;
                if (flight.layovers && index < flight.layovers.length) {
                    flightDetailsHtml += `
                        <div class="layover-details">
                            Layover: ${formatDuration(flight.layovers[index].duration)} in ${flight.layovers[index].name}
                        </div>
                    `;
                }
            });


            const airlineLogo = flight.flights?.[0]?.airline_logo || '';
            const airline = flight.flights?.[0]?.airline || 'N/A';
            
            const duration = formatDuration(flight.total_duration);
            const layovers = formatLayovers(flight.layovers);
            
            const priceDisplay = flight.price ? `${flight.price}` : 'N/A';
            const pricePerPerson = (flight.price && currentSearch?.passengers > 1) ? 
                `${Math.round(flight.price / currentSearch.passengers)} per person` : '';

            const googleFlightsUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${currentSearch.departure}%20to%20${currentSearch.arrival}%20on%20${currentSearch.outboundDate}${currentSearch.returnDate ? `%20through%20${currentSearch.returnDate}` : ''}`;

            flightCard.innerHTML = `
                <div class="flight-info">
                    <div class="flight-summary">
                        <img src="${airlineLogo}" alt="${airline} logo" class="airline-logo" onerror="this.style.display='none'">
                        <div class="flight-details">
                            <h3>${airline}</h3>
                            <p class="route">${departureAirport} → ${arrivalAirport}</p>
                            <p>Duration: ${duration} • ${layovers}</p>
                        </div>
                    </div>
                    <div class="flight-legs-container">
                        ${flightDetailsHtml}
                    </div>
                </div>
                <div class="price-section">
                    <p class="price">${priceDisplay}</p>
                    ${pricePerPerson ? `<p class="per-person">${pricePerPerson}</p>` : ''}
                    <a href="${googleFlightsUrl}" target="_blank" class="view-deals-btn">View Deals</a>
                </div>
            `;
            resultsContainer.appendChild(flightCard);
        });
    }

    function showLoading() {
        loadingIndicator.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        resultsContainer.innerHTML = '';
    }

    function hideLoading() {
        loadingIndicator.classList.add('hidden');
    }

    function showError(message = 'Sorry, something went wrong. Please try again.') {
        errorMessage.innerHTML = `<p>${message}</p>`;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    function showNoResults() {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <h3>No flights found</h3>
                <p>Try adjusting your search criteria or dates to find more options.</p>
            </div>
        `;
    }
});
