<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Laravel</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    <script type="text/javascript" src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBCToIMP1Rk6ZbGcfnJ2iwsnb09_lnxLmY&libraries=places"></script>
</head>
<body>
    <div id="app"></div>
</body>
</html> 
