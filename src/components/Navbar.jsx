function Navbar() {
    return (
        <header className="navbar">
            <nav>
                <div className="logo">
                    <span className="logo-icon">✈</span>
                    <span>FlyNow</span>
                </div>

                <ul>
                    <li><a href="#">Home</a></li>
                    <li><a href="#">Flights</a></li>
                    <li><a href="#">Hotels</a></li>
                    <li><a href="#">Packages</a></li>
                    <li><a href="#">Support</a></li>
                </ul>
            </nav>
        </header>
    );
}

export default Navbar;