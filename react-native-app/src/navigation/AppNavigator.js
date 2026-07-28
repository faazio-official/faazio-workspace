"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppNavigator = AppNavigator;
var react_1 = require("react");
var native_stack_1 = require("@react-navigation/native-stack");
var OnboardingScreen_1 = require("../features/onboarding/OnboardingScreen");
var LoginScreen_1 = require("../features/auth/LoginScreen");
var LocationScreen_1 = require("../features/auth/LocationScreen");
var MainDashboardScreen_1 = require("../features/home/MainDashboardScreen");
var Stack = (0, native_stack_1.createNativeStackNavigator)();
function AppNavigator() {
    return (<Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
      <Stack.Screen name="Onboarding" component={OnboardingScreen_1.OnboardingScreen}/>
      <Stack.Screen name="Login" component={LoginScreen_1.LoginScreen}/>
      <Stack.Screen name="Location" component={LocationScreen_1.LocationScreen}/>
      <Stack.Screen name="MainTabs" component={MainDashboardScreen_1.MainDashboardScreen}/>
    </Stack.Navigator>);
}
