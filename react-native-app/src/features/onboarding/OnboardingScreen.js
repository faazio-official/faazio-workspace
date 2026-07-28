"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingScreen = OnboardingScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
// Import images matching the source assets
var welcome_illustration_1_png_1 = require("../../assets/welcome_illustration_1.png");
var welcome_illustration_2_png_1 = require("../../assets/welcome_illustration_2.png");
var welcome_illustration_3_png_1 = require("../../assets/welcome_illustration_3.png");
var welcome_illustration_4_png_1 = require("../../assets/welcome_illustration_4.png");
var ONBOARDING_DATA = [
    {
        title: 'Welcome to Faazio',
        subtitle: 'Your Daily SuperApp',
        description: 'Simplify your life. Shop essentials, order delicious food, book travel tickets, and access trusted local e-services inside one seamless interface.',
        bgColor: '#ffffff',
        accentColor: '#2c56f6',
        bgCircleColor: '#f1f5f9',
        image: welcome_illustration_1_png_1.default,
    },
    {
        title: 'Smart Shopping',
        subtitle: 'Essentials Made Easy',
        description: 'Experience instant deliveries of groceries, household essentials, and favorite brands from vetted local stores direct to your doorstep.',
        bgColor: '#ffffff',
        accentColor: '#e11d48',
        bgCircleColor: '#fff1f2',
        image: welcome_illustration_2_png_1.default,
    },
    {
        title: 'Satisfy Your Hunger',
        subtitle: 'Hot Food Ordering',
        description: 'Craving something hot and delicious? Order from premier local restaurants and track your delivery in real-time with zero hassle.',
        bgColor: '#ffffff',
        accentColor: '#16a34a',
        bgCircleColor: '#f0fdf4',
        image: welcome_illustration_3_png_1.default,
    },
    {
        title: 'Instant E-Services',
        subtitle: 'And Hassle-Free Booking',
        description: 'From certified home repairs to booking movie, bus, or train tickets—Faazio handles your entire chore list instantly.',
        bgColor: '#ffffff',
        accentColor: '#9333ea',
        bgCircleColor: '#faf5ff',
        image: welcome_illustration_4_png_1.default,
    },
];
var SCREEN_HEIGHT = react_native_1.Dimensions.get('window').height;
function OnboardingScreen(_a) {
    var navigation = _a.navigation;
    var _b = (0, react_1.useState)(0), currentStep = _b[0], setCurrentStep = _b[1];
    var handleNext = function () {
        if (currentStep < ONBOARDING_DATA.length - 1) {
            setCurrentStep(function (prev) { return prev + 1; });
        }
        else {
            navigation.navigate('Login');
        }
    };
    var handleBack = function () {
        if (currentStep > 0) {
            setCurrentStep(function (prev) { return prev - 1; });
        }
    };
    var handleSkip = function () {
        navigation.navigate('Login');
    };
    var currentData = ONBOARDING_DATA[currentStep];
    return (<react_native_1.SafeAreaView style={[styles.container, { backgroundColor: currentData.bgColor }]}>
      {/* Header Bar */}
      <react_native_1.View style={styles.header}>
        {/* Custom Faazio Brand Logo Title */}
        <react_native_1.View style={styles.brandContainer}>
          <react_native_1.Text style={styles.brandTitle}>Faazio</react_native_1.Text>
          <react_native_1.View style={styles.brandDot}/>
        </react_native_1.View>
        <react_native_1.TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <react_native_1.Text style={styles.skipText}>Skip</react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      {/* Main Content Area */}
      <react_native_1.View style={styles.contentContainer}>
        {/* Rounded dynamic background circle wrapper for illustrations */}
        <react_native_1.View style={[styles.illustrationWrapper, { backgroundColor: currentData.bgCircleColor }]}>
          <react_native_1.Image source={currentData.image} style={styles.illustrationImage} resizeMode="contain"/>
        </react_native_1.View>

        {/* Text Details Section */}
        <react_native_1.View style={styles.textDetails}>
          <react_native_1.Text style={styles.titleText}>{currentData.title}</react_native_1.Text>
          <react_native_1.Text style={[styles.subtitleText, { color: currentData.accentColor }]}>
            {currentData.subtitle}
          </react_native_1.Text>
          <react_native_1.View style={[styles.underline, { backgroundColor: currentData.accentColor }]}/>
          <react_native_1.Text style={styles.descriptionText}>{currentData.description}</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* Footer Navigation */}
      <react_native_1.View style={styles.footer}>
        {/* Progress Dots Indicator */}
        <react_native_1.View style={styles.dotsContainer}>
          {ONBOARDING_DATA.map(function (_, index) {
            var isActive = index === currentStep;
            return (<react_native_1.View key={index} style={[
                    styles.dot,
                    isActive
                        ? [styles.activeDot, { backgroundColor: currentData.accentColor }]
                        : [styles.inactiveDot, { backgroundColor: '#cbd5e1' }]
                ]}/>);
        })}
        </react_native_1.View>

        {/* Action Button Controls */}
        <react_native_1.View style={styles.buttonsRow}>
          {currentStep > 0 && (<react_native_1.TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.8}>
              <react_native_1.Text style={styles.backButtonText}>Back</react_native_1.Text>
            </react_native_1.TouchableOpacity>)}
          <react_native_1.TouchableOpacity onPress={handleNext} style={[styles.nextButton, { backgroundColor: currentData.accentColor }]} activeOpacity={0.8}>
            <react_native_1.Text style={styles.nextButtonText}>
              {currentStep === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Next'}
            </react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.SafeAreaView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 12,
        height: 54,
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#2c56f6',
        marginLeft: 3,
        marginTop: 4,
    },
    skipButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    skipText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    illustrationWrapper: {
        width: '100%',
        aspectRatio: 1.15,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SCREEN_HEIGHT < 700 ? 16 : 28,
        overflow: 'hidden',
        padding: 16,
    },
    illustrationImage: {
        width: '100%',
        height: '100%',
    },
    textDetails: {
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 12,
    },
    titleText: {
        fontSize: SCREEN_HEIGHT < 700 ? 18 : 22,
        fontWeight: '900',
        color: '#0f172a',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitleText: {
        fontSize: SCREEN_HEIGHT < 700 ? 12 : 13,
        fontWeight: '800',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 4,
    },
    underline: {
        width: 36,
        height: 3,
        borderRadius: 1.5,
        marginVertical: SCREEN_HEIGHT < 700 ? 10 : 16,
    },
    descriptionText: {
        fontSize: SCREEN_HEIGHT < 700 ? 11 : 12.5,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: SCREEN_HEIGHT < 700 ? 16 : 20,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: SCREEN_HEIGHT < 700 ? 16 : 24,
        height: 70,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        height: 6,
        borderRadius: 3,
        marginHorizontal: 3,
    },
    activeDot: {
        width: 16,
    },
    inactiveDot: {
        width: 6,
    },
    buttonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
    },
    backButtonText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '700',
    },
    nextButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2c56f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    nextButtonText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
});
