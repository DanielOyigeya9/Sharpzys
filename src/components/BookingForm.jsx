import { useState } from "react";

function BookingForm() {
    const [tripType, setTripType] = useState("oneway");
    const [adults, setAdults] = useState(1);
    const [children, setChildren] = useState(0);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [departDate, setDepartDate] = useState("2026-09-04");
    const [returnDate, setReturnDate] = useState("");
    const [travelClass, setTravelClass] = useState("Economy");
    const [flexibleDates, setFlexibleDates] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [showPaxModal, setShowPaxModal] = useState(false);

    const handleTripChange = (nextType) => {
        setTripType(nextType);
        if (nextType === "oneway") {
            setReturnDate("");
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!from.trim() || !to.trim() || !departDate) {
            window.alert("Please complete all required fields.");
            return;
        }

        setIsSearching(true);

        window.setTimeout(() => {
            setIsSearching(false);
            window.alert(
                `Search Complete!\n\nFrom: ${from}\nTo: ${to}\nDeparture: ${departDate}\nReturn: ${
                    tripType === "oneway" ? "N/A" : returnDate || "Not selected"
                }\nTravel Class: ${travelClass}\nAdults: ${adults}\nChildren: ${children}\n\n(Connect this form to an API later to display real flights.)`
            );
        }, 1800);
    };

    /* Swap From and To values */
    const handleSwap = () => {
        const tempFrom = from;
        setFrom(to);
        setTo(tempFrom);
    };

    /* Format date display for mobile (e.g., Fri 04 Sept) */
    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return "Select Date";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString("en-US", {
                weekday: "short",
                day: "02-digit",
                month: "short"
            });
        } catch {
            return dateStr;
        }
    };

    const paxSummary = `${adults + children} ${adults + children === 1 ? "Adult" : "Passengers"}, ${travelClass}`;

    return (
        <div className="booking-card-wrapper">
            {/* ── Trip type tabs ── */}
            <div className="tabs">
                <button
                    className={tripType === "round" ? "tab active" : "tab"}
                    onClick={() => handleTripChange("round")}
                    type="button"
                >
                    Return
                </button>
                <button
                    className={tripType === "oneway" ? "tab active" : "tab"}
                    onClick={() => handleTripChange("oneway")}
                    type="button"
                >
                    One way
                </button>
                <button
                    className={tripType === "multi" ? "tab active" : "tab"}
                    onClick={() => handleTripChange("multi")}
                    type="button"
                >
                    Multi-city
                </button>
            </div>

            <div className="booking-card">
                <form id="bookingForm" onSubmit={handleSubmit}>
                    {/* ── FROM / TO BLOCK ── */}
                    <div className="from-to-card-group">
                        {/* WHERE FROM */}
                        <div className="field-box from-field">
                            <label htmlFor="fromInput">Where from?</label>
                            <input
                                id="fromInput"
                                type="text"
                                placeholder="City or airport"
                                value={from}
                                onChange={(event) => setFrom(event.target.value)}
                                required
                            />
                        </div>

                        {/* SWAP BUTTON */}
                        <button
                            type="button"
                            className="swap-circle-btn"
                            onClick={handleSwap}
                            aria-label="Swap locations"
                        >
                            ⇅
                        </button>

                        {/* WHERE TO */}
                        <div className="field-box to-field">
                            <label htmlFor="toInput">Where to?</label>
                            <input
                                id="toInput"
                                type="text"
                                placeholder="City or airport"
                                value={to}
                                onChange={(event) => setTo(event.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* ── DATE | PASSENGERS & CLASS BLOCK ── */}
                    <div className="date-pax-card-group">
                        {/* DATE BOX */}
                        <div className="field-box date-field">
                            <label htmlFor="departDateInput">Date</label>
                            <div className="custom-input-wrap">
                                <span className="date-display-text">{formatDisplayDate(departDate)}</span>
                                <input
                                    id="departDateInput"
                                    type="date"
                                    value={departDate}
                                    onChange={(event) => setDepartDate(event.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* PASSENGERS & CLASS BOX */}
                        <div className="field-box pax-field" onClick={() => setShowPaxModal(!showPaxModal)}>
                            <label>Passengers & Class</label>
                            <div className="pax-display-text">{paxSummary}</div>

                            {/* Dropdown popup for passenger counts & class */}
                            {showPaxModal && (
                                <div className="pax-dropdown-popover" onClick={(e) => e.stopPropagation()}>
                                    <div className="pax-popover-row">
                                        <span>Travel Class</span>
                                        <select
                                            value={travelClass}
                                            onChange={(e) => setTravelClass(e.target.value)}
                                        >
                                            <option>Economy</option>
                                            <option>Premium Economy</option>
                                            <option>Business</option>
                                            <option>First Class</option>
                                        </select>
                                    </div>
                                    <div className="pax-popover-row">
                                        <span>Adults</span>
                                        <div className="pax-counter-btn-group">
                                            <button
                                                type="button"
                                                onClick={() => setAdults((v) => Math.max(1, v - 1))}
                                            >
                                                −
                                            </button>
                                            <span>{adults}</span>
                                            <button
                                                type="button"
                                                onClick={() => setAdults((v) => Math.min(9, v + 1))}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pax-popover-row">
                                        <span>Children</span>
                                        <div className="pax-counter-btn-group">
                                            <button
                                                type="button"
                                                onClick={() => setChildren((v) => Math.max(0, v - 1))}
                                            >
                                                −
                                            </button>
                                            <span>{children}</span>
                                            <button
                                                type="button"
                                                onClick={() => setChildren((v) => Math.min(9, v + 1))}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="pax-done-btn"
                                        onClick={() => setShowPaxModal(false)}
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hidden return date input for round trips */}
                    {tripType === "round" && (
                        <div className="field-box return-date-box">
                            <label>Return Date</label>
                            <input
                                type="date"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Flexible dates checkbox */}
                    <div className="flexible-checkbox-wrap">
                        <label>
                            <input
                                type="checkbox"
                                checked={flexibleDates}
                                onChange={(event) => setFlexibleDates(event.target.checked)}
                            />
                            Flexible with dates
                        </label>
                    </div>

                    {/* SEARCH FLIGHTS BUTTON */}
                    <button className="search-btn" type="submit" disabled={isSearching}>
                        {isSearching ? "Searching flights..." : "Search flights"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default BookingForm;