# 🚨 Emergency Services Finder

<p align="center">
  <img src="https://img.shields.io/badge/Project-Emergency%20Services%20Finder-red?style=for-the-badge" alt="Project">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet">
  <img src="https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=for-the-badge&logo=openstreetmap&logoColor=white" alt="OpenStreetMap">
  <img src="https://img.shields.io/badge/Overpass%20API-4CAF50?style=for-the-badge" alt="Overpass API">
  <img src="https://img.shields.io/badge/GitHub%20Pages-222222?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Pages">
</p>

<p align="center">
  A location-based web application that helps users find nearby emergency services quickly and share their location during emergencies.
</p>

---

## 📌 About The Project

**Emergency Services Finder** is a web-based emergency assistance application designed to help users quickly locate important services around them.

The application uses the user's current location to find nearby:

- 🏥 Hospitals
- 👮 Police Stations
- 💊 Pharmacies

It also provides an **SOS system** that allows users to share their current location with saved favorite contacts through SMS, WhatsApp, or the device's native sharing system.

---

## ✨ Features

### 📍 Current Location

The application uses the browser's **Geolocation API** to detect the user's current location.

### 🗺️ Interactive Map

An interactive map displays the user's location and nearby emergency services using:

- Leaflet.js
- OpenStreetMap
- Overpass API

### 🏥 Nearby Hospitals

Find hospitals near the user's current location.

### 👮 Nearby Police Stations

Find police stations around the user's current location.

### 💊 Nearby Pharmacies

Find pharmacies available near the user.

### 🔎 Service Filtering

Users can filter emergency services based on the required service category.

### ❤️ Favorite Contacts

Users can save important people as favorite emergency contacts.

### 🚨 SOS Emergency System

The SOS button provides quick access to emergency communication options.

### 📱 SMS Emergency Alert

The application can prepare an emergency SMS containing the user's current location and favorite contacts.

### 💬 WhatsApp Sharing

Users can share their emergency location through WhatsApp.

### 📤 Open Sharing

The application can use the device's native sharing menu to share the emergency message through supported applications.

### 🧭 Directions

Users can get directions to selected emergency services.

### 🔐 Login & Registration

The project includes a basic login and registration interface.

### 📱 Responsive Design

The website is designed to work on both desktop and mobile devices.

---

# 🛠️ Technologies Used

<p align="center">

<img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white">

<img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white">

<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black">

<img src="https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white">

<img src="https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=flat-square&logo=openstreetmap&logoColor=white">

</p>

| Technology | Purpose |
|------------|---------|
| HTML5 | Website structure |
| CSS3 | Website styling and responsive design |
| JavaScript | Application logic |
| Leaflet.js | Interactive maps |
| OpenStreetMap | Map data and map tiles |
| Overpass API | Finding nearby emergency services |
| Geolocation API | Detecting user's location |
| Web Share API | Native device sharing |
| SMS URI | Opening the device SMS application |
| GitHub Pages | Website hosting |

---

# 🗺️ How The Application Works

```text
                 👤 USER
                   │
                   ▼
          📍 Browser Location
                   │
                   ▼
          Latitude + Longitude
                   │
                   ▼
           ┌───────────────┐
           │  Overpass API │
           └───────┬───────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
       🏥         👮         💊
    Hospital     Police    Pharmacy
        │          │          │
        └──────────┼──────────┘
                   ▼
             🗺️ Leaflet Map
                   │
                   ▼
              👤 User
