"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var expo_status_bar_1 = require("expo-status-bar");
var react_native_safe_area_context_1 = require("react-native-safe-area-context");
var native_1 = require("@react-navigation/native");
var AppNavigator_1 = require("./src/navigation/AppNavigator");
function App() {
    return (<react_native_safe_area_context_1.SafeAreaProvider>
      <native_1.NavigationContainer>
        <AppNavigator_1.AppNavigator />
        <expo_status_bar_1.StatusBar style="auto"/>
      </native_1.NavigationContainer>
    </react_native_safe_area_context_1.SafeAreaProvider>);
}
