"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginScreen = LoginScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var react_native_2 = require("react-native");
var react_native_svg_1 = require("react-native-svg");
var phone_auth_background_png_1 = require("../../assets/phone_auth_background.png");
var _a = react_native_1.Dimensions.get('window'), SCREEN_WIDTH = _a.width, SCREEN_HEIGHT = _a.height;
var SmilingCoinHandIllustration = function () { return (<react_native_svg_1.default viewBox="0 0 100 100" width={88} height={88}>
    <react_native_svg_1.Circle cx="50" cy="50" r="45" fill="#ffd037"/>
    <react_native_svg_1.Circle cx="50" cy="50" r="41" fill="#ffc107"/>
    <react_native_svg_1.Circle cx="50" cy="50" r="38" fill="#ffd037"/>
    <react_native_svg_1.Circle cx="36" cy="42" r="5" fill="#1e293b"/>
    <react_native_svg_1.Circle cx="64" cy="42" r="5" fill="#1e293b"/>
    <react_native_svg_1.Circle cx="34" cy="40" r="1.5" fill="#ffffff"/>
    <react_native_svg_1.Circle cx="62" cy="40" r="1.5" fill="#ffffff"/>
    <react_native_svg_1.Ellipse cx="26" cy="54" rx="7" ry="4" fill="#ff8a80" opacity="0.6"/>
    <react_native_svg_1.Ellipse cx="74" cy="54" rx="7" ry="4" fill="#ff8a80" opacity="0.6"/>
    <react_native_svg_1.Path d="M 30 60 Q 50 80 70 60" fill="none" stroke="#1e293b" strokeWidth="4" strokeLinecap="round"/>
    <react_native_svg_1.Path d="M 40 68 Q 50 78 60 68" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
  </react_native_svg_1.default>); };
function LoginScreen(_a) {
    var navigation = _a.navigation;
    var _b = (0, react_1.useState)(''), phone = _b[0], setPhone = _b[1];
    var _c = (0, react_1.useState)(false), otpState = _c[0], setOtpState = _c[1];
    var _d = (0, react_1.useState)(''), otpCode = _d[0], setOtpCode = _d[1];
    var _e = (0, react_1.useState)(''), otpError = _e[0], setOtpError = _e[1];
    var _f = (0, react_1.useState)(false), showAllDoneState = _f[0], setShowAllDoneState = _f[1];
    var _g = (0, react_1.useState)(false), isKeyboardActive = _g[0], setIsKeyboardActive = _g[1];
    var phoneInputRef = (0, react_1.useRef)(null);
    var otpInputRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var timer = setTimeout(function () {
            var _a, _b;
            if (!otpState) {
                (_a = phoneInputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            }
            else {
                (_b = otpInputRef.current) === null || _b === void 0 ? void 0 : _b.focus();
            }
        }, 400);
        return function () { return clearTimeout(timer); };
    }, [otpState]);
    (0, react_1.useEffect)(function () {
        var keyboardDidShowListener = react_native_1.Keyboard.addListener(react_native_1.Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', function () { return setIsKeyboardActive(true); });
        var keyboardDidHideListener = react_native_1.Keyboard.addListener(react_native_1.Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', function () { return setIsKeyboardActive(false); });
        return function () {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);
    var handleVerifyOtp = function (code) {
        if (code === '123456' || code === '1234') {
            setTimeout(function () {
                setShowAllDoneState(true);
            }, 250);
        }
        else {
            setOtpError('Invalid code! Please use 123456 for testing.');
        }
    };
    (0, react_1.useEffect)(function () {
        if (showAllDoneState) {
            var timer_1 = setTimeout(function () {
                navigation.navigate('Location');
            }, 2000);
            return function () { return clearTimeout(timer_1); };
        }
    }, [showAllDoneState, navigation]);
    var handlePhoneChange = function (val) {
        var numericVal = val.replace(/\D/g, '');
        setPhone(numericVal);
        if (numericVal.length === 10) {
            setTimeout(function () {
                setOtpState(true);
                setOtpError('');
                react_native_1.Keyboard.dismiss();
            }, 150);
        }
    };
    var handleOtpChange = function (val) {
        var numericVal = val.replace(/\D/g, '');
        if (numericVal.length <= 6) {
            setOtpCode(numericVal);
            setOtpError('');
            if (numericVal.length === 6) {
                handleVerifyOtp(numericVal);
            }
        }
    };
    if (showAllDoneState) {
        return (<react_native_1.View style={[styles.container, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }]}>
        <react_native_2.ActivityIndicator size="large" color="#2c56f6"/>
      </react_native_1.View>);
    }
    return (<react_native_1.View style={styles.container}>
      {!otpState ? (<react_native_1.View style={styles.phoneStateContainer}>
          <react_native_1.TouchableOpacity onPress={function () { return navigation.navigate('Onboarding'); }} style={styles.backBtn} activeOpacity={0.8}>
            <lucide_react_native_1.ChevronLeft size={20} color="#1e293b" strokeWidth={2.5}/>
          </react_native_1.TouchableOpacity>

          <react_native_1.TouchableOpacity style={[styles.topImageContainer, { height: isKeyboardActive ? '20%' : '45%' }]} onPress={function () { return react_native_1.Keyboard.dismiss(); }} activeOpacity={1}>
            <react_native_1.Image source={phone_auth_background_png_1.default} style={styles.topImage} resizeMode="cover"/>
          </react_native_1.TouchableOpacity>

          <react_native_1.TouchableOpacity activeOpacity={1} onPress={function () { return react_native_1.Keyboard.dismiss(); }} style={[styles.bottomSheet, isKeyboardActive ? styles.bottomSheetKeyboardActive : styles.bottomSheetKeyboardInactive]}>
            <react_native_1.View style={styles.badgeContainer}>
              <SmilingCoinHandIllustration />
            </react_native_1.View>

            <react_native_1.View style={[styles.headerBlock, isKeyboardActive ? { marginTop: 8, marginBottom: 8 } : { marginTop: 16, marginBottom: 12 }]}>
              <react_native_1.Text style={[styles.exploreTitle, isKeyboardActive ? { fontSize: 28 } : { fontSize: 42 }]}>
                Explore
              </react_native_1.Text>
            </react_native_1.View>

            <react_native_1.View style={styles.formContainer}>
              <react_native_1.View style={styles.phoneInputRow}>
                <react_native_1.Text style={styles.countryCode}>(+91)</react_native_1.Text>
                <react_native_1.View style={styles.separator}/>
                <react_native_1.TextInput ref={phoneInputRef} style={styles.textInput} placeholder="Enter your mobile number" placeholderTextColor="#e2e8f0" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={handlePhoneChange}/>
              </react_native_1.View>

              <react_native_1.Text style={styles.termsText}>
                By clicking, I accept the <react_native_1.Text style={styles.termsLink}>Terms & Conditions</react_native_1.Text> and <react_native_1.Text style={styles.termsLink}>Privacy Policy</react_native_1.Text>
              </react_native_1.Text>

              <react_native_1.View style={styles.loaderContainer}>
                {phone.length === 10 && (<react_native_1.View style={styles.loadingPill}>
                    <react_native_1.View style={styles.spinnerCircle}/>
                    <react_native_1.Text style={styles.loadingText}>Sending OTP...</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.View>
            </react_native_1.View>

            <react_native_1.View style={styles.demoNoteContainer}>
              <react_native_1.Text style={styles.demoNoteText}>💡 Demo Mode • Enter any number & any 6-digit OTP code</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>) : (<react_native_1.View style={styles.otpStateContainer}>
          <react_native_1.View style={[react_native_1.StyleSheet.absoluteFill, styles.otpBgColor]}/>

          <react_native_1.TouchableOpacity style={styles.otpTopDismissArea} onPress={function () { return react_native_1.Keyboard.dismiss(); }} activeOpacity={1}/>

          <react_native_1.TouchableOpacity onPress={function () {
                setOtpState(false);
                setOtpCode('');
                setOtpError('');
            }} style={styles.backBtn} activeOpacity={0.8}>
            <lucide_react_native_1.ChevronLeft size={20} color="#1e293b" strokeWidth={2.5}/>
          </react_native_1.TouchableOpacity>

          <react_native_1.View style={styles.otpHeaderContainer}>
            <react_native_1.Text style={styles.otpHeaderTitle}>Lets get verified</react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View style={styles.checkCircleBg}/>
          <react_native_1.View style={styles.checkCircleIcon}>
            <react_native_svg_1.default viewBox="0 0 24 24" fill="none" width="100%" height="100%">
              <react_native_svg_1.Polyline points="20 6 9 17 4 12" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </react_native_svg_1.default>
          </react_native_1.View>

          <react_native_1.View style={[styles.otpBlueCurve, { top: isKeyboardActive ? '13.7%' : '22.7%' }]}/>

          <react_native_1.TouchableOpacity style={[styles.otpWhiteDome, { top: isKeyboardActive ? '15.2%' : '24.2%' }]} onPress={function () { var _a; return (_a = otpInputRef.current) === null || _a === void 0 ? void 0 : _a.focus(); }} activeOpacity={1}>
            <react_native_1.View style={styles.otpWhiteContent}>
              <react_native_1.View style={styles.otpPromptContainer}>
                <react_native_1.Text style={styles.securePromptSub}>Secure Verification</react_native_1.Text>
                <react_native_1.Text style={styles.securePromptMain}>Enter the code sent to</react_native_1.Text>
                <react_native_1.Text style={styles.securePromptPhone}>{phone ? "+91 ".concat(phone) : '+9876543210'}</react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.otpSegmentsContainer}>
                <react_native_1.TextInput ref={otpInputRef} style={styles.hiddenOtpInput} keyboardType="number-pad" maxLength={6} value={otpCode} onChangeText={handleOtpChange} caretHidden={true}/>

                <react_native_1.View style={styles.segmentsRow}>
                  {Array.from({ length: 6 }).map(function (_, index) {
                var digit = otpCode[index];
                var isCurrent = index === otpCode.length;
                var isFilled = digit !== undefined;
                return (<react_native_1.View key={index} style={styles.segmentColumn}>
                        <react_native_1.View style={styles.segmentDigitContainer}>
                          {isFilled ? (<react_native_1.Text style={styles.segmentDigit}>{digit}</react_native_1.Text>) : (<react_native_1.Text style={styles.segmentDot}>•</react_native_1.Text>)}
                        </react_native_1.View>
                        <react_native_1.View style={[
                        styles.segmentTrack,
                        otpError ? styles.segmentTrackError :
                            isFilled ? styles.segmentTrackFilled :
                                isCurrent ? styles.segmentTrackCurrent :
                                    styles.segmentTrackDefault
                    ]}/>
                      </react_native_1.View>);
            })}
                </react_native_1.View>
                
                {otpError ? (<react_native_1.Text style={styles.otpErrorText}>{otpError}</react_native_1.Text>) : null}
              </react_native_1.View>

              <react_native_1.View style={styles.otpFooterContainer}>
                <react_native_1.View style={styles.warningBox}>
                  <react_native_1.Text style={styles.warningBoxText}>Do not share this code with anyone. Our executives will never ask for your OTP.</react_native_1.Text>
                </react_native_1.View>

                <react_native_1.View style={styles.resendRow}>
                  <react_native_1.Text style={styles.resendTextSub}>Didn't receive code?</react_native_1.Text>
                  <react_native_1.TouchableOpacity activeOpacity={0.7} onPress={function () { setOtpCode(''); setOtpError(''); react_native_1.Alert.alert('Sent', 'A new OTP has been sent.'); }}>
                    <react_native_1.Text style={styles.resendTextAction}>Request Again</react_native_1.Text>
                  </react_native_1.TouchableOpacity>
                </react_native_1.View>

                <react_native_1.TouchableOpacity style={[
                styles.confirmOtpBtn,
                otpCode.length === 6 ? styles.confirmOtpBtnActive : styles.confirmOtpBtnInactive
            ]} activeOpacity={0.8} onPress={function () {
                if (otpCode.length === 6) {
                    handleVerifyOtp(otpCode);
                }
            }}>
                  <react_native_1.Text style={[
                styles.confirmOtpBtnText,
                otpCode.length === 6 ? styles.confirmOtpBtnTextActive : styles.confirmOtpBtnTextInactive
            ]}>Confirm OTP</react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.View>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>)}
    </react_native_1.View>);
}
var styles = react_native_1.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    phoneStateContainer: { flex: 1, backgroundColor: '#ffffff' },
    backBtn: {
        position: 'absolute',
        top: react_native_1.Platform.OS === 'ios' ? 44 : 20,
        left: 16,
        zIndex: 40,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.1)',
    },
    topImageContainer: { width: '100%', backgroundColor: '#ffffff', zIndex: 0 },
    topImage: { width: '100%', height: '100%' },
    bottomSheet: {
        flex: 1,
        backgroundColor: '#2c56f6',
        borderTopLeftRadius: 44,
        borderTopRightRadius: 44,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -15 },
        shadowOpacity: 0.18,
        shadowRadius: 35,
        elevation: 20,
        paddingHorizontal: 24,
        position: 'relative',
        zIndex: 10,
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    bottomSheetKeyboardInactive: { marginTop: -40, paddingTop: 48, paddingBottom: 40 },
    bottomSheetKeyboardActive: { marginTop: 0, paddingTop: 32, paddingBottom: 48 },
    badgeContainer: {
        position: 'absolute',
        top: -44,
        left: SCREEN_WIDTH / 2 - 44,
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 8,
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        zIndex: 25,
    },
    headerBlock: { alignItems: 'center' },
    exploreTitle: {
        color: '#ffffff',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: -0.5,
    },
    formContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    phoneInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 30,
        paddingHorizontal: 20,
        paddingVertical: 12,
        width: '100%',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 25,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    countryCode: { fontSize: 14, fontWeight: '800', color: '#212121' },
    separator: { width: 1, height: 16, backgroundColor: '#e2e8f0', marginHorizontal: 10 },
    textInput: { flex: 1, fontSize: 14, fontWeight: '600', color: '#212121' },
    termsText: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginTop: 14,
        paddingHorizontal: 8,
        lineHeight: 16,
    },
    termsLink: { fontWeight: '800', textDecorationLine: 'underline' },
    loaderContainer: { minHeight: 44, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
    loadingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#41E68F',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 30,
        shadowColor: '#41E68F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
    },
    spinnerCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#212121',
        borderTopColor: 'transparent',
        marginRight: 10,
    },
    loadingText: { color: '#212121', fontWeight: '900', fontSize: 12 },
    demoNoteContainer: { alignItems: 'center', marginTop: 'auto' },
    demoNoteText: { fontSize: 9, color: 'rgba(255, 255, 255, 0.6)' },
    otpStateContainer: { flex: 1, backgroundColor: '#2c56f6' },
    otpBgColor: { backgroundColor: '#2c56f6' },
    otpTopDismissArea: { position: 'absolute', top: 0, left: 0, right: 0, height: '24.2%', zIndex: 30 },
    otpHeaderContainer: { position: 'absolute', top: '4.4%', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
    otpHeaderTitle: { color: '#ffffff', fontWeight: '900', textTransform: 'uppercase', fontSize: 24, letterSpacing: -0.5 },
    checkCircleBg: {
        position: 'absolute',
        top: '12.65%',
        left: SCREEN_WIDTH / 2 - (SCREEN_WIDTH * 0.133) / 2,
        width: '13.3%',
        aspectRatio: 1,
        borderRadius: SCREEN_WIDTH,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        zIndex: 10,
    },
    checkCircleIcon: {
        position: 'absolute',
        top: '13.9%',
        left: SCREEN_WIDTH / 2 - (SCREEN_WIDTH * 0.08) / 2,
        width: '8%',
        aspectRatio: 1,
        zIndex: 20,
    },
    otpBlueCurve: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#2b51db',
        zIndex: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -24 },
        shadowOpacity: 0.08,
        shadowRadius: 33,
        elevation: 15,
        borderTopLeftRadius: 44,
        borderTopRightRadius: 44,
    },
    otpWhiteDome: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
        zIndex: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -24 },
        shadowOpacity: 0.08,
        shadowRadius: 33,
        elevation: 20,
        borderTopLeftRadius: 44,
        borderTopRightRadius: 44,
    },
    otpWhiteContent: { flex: 1, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' },
    otpPromptContainer: { alignItems: 'center', marginBottom: 20 },
    securePromptSub: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
    securePromptMain: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 2 },
    securePromptPhone: { fontSize: 20, fontWeight: '900', color: '#2f80ed', letterSpacing: 0.5 },
    otpSegmentsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', position: 'relative' },
    hiddenOtpInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 40, color: 'transparent' },
    segmentsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, width: '100%', maxWidth: 320, zIndex: 30 },
    segmentColumn: { alignItems: 'center', width: 44 },
    segmentDigitContainer: { height: 48, justifyContent: 'center', alignItems: 'center' },
    segmentDigit: { fontSize: 30, fontWeight: '900', color: '#1e293b', letterSpacing: -1 },
    segmentDot: { fontSize: 12, fontWeight: '900', color: '#cbd5e1' },
    segmentTrack: { height: 4, borderRadius: 2, width: '100%', marginTop: 4 },
    segmentTrackDefault: { backgroundColor: '#e2e8f0' },
    segmentTrackCurrent: { backgroundColor: '#3b82f6', height: 5 },
    segmentTrackFilled: { backgroundColor: '#2f80ed', height: 5 },
    segmentTrackError: { backgroundColor: '#f43f5e' },
    otpErrorText: { position: 'absolute', bottom: -20, color: '#f43f5e', fontSize: 11, fontWeight: '700' },
    otpFooterContainer: { width: '100%', alignItems: 'center', paddingBottom: 24 },
    warningBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, width: '100%', marginBottom: 20 },
    warningBoxText: { fontSize: 10, color: '#d97706', textAlign: 'center', fontWeight: '600', lineHeight: 14 },
    resendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    resendTextSub: { fontSize: 12, color: '#64748b', fontWeight: '600', marginRight: 6 },
    resendTextAction: { fontSize: 12, color: '#2f80ed', fontWeight: '800' },
    confirmOtpBtn: { width: '100%', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    confirmOtpBtnActive: { backgroundColor: '#2c56f6', shadowColor: '#2c56f6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 },
    confirmOtpBtnInactive: { backgroundColor: '#f1f5f9' },
    confirmOtpBtnText: { fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
    confirmOtpBtnTextActive: { color: '#ffffff' },
    confirmOtpBtnTextInactive: { color: '#94a3b8' },
});
