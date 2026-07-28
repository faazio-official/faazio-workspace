"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationScreen = LocationScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var react_native_svg_1 = require("react-native-svg");
var location_access_page_png_1 = require("../../assets/location_access_page.png");
var MAP_LOADING_GIF_URL = "https://i.pinimg.com/originals/f3/f9/ce/f3f9ce3dfdb88b90f4e3c5ec7bc5dc85.gif";
function LocationScreen(_a) {
    var navigation = _a.navigation;
    var _b = (0, react_1.useState)('request'), step = _b[0], setStep = _b[1];
    var _c = (0, react_1.useState)('Sunnambukkara Street, Karaikal'), selectedLocation = _c[0], setSelectedLocation = _c[1];
    var _d = (0, react_1.useState)(''), searchQuery = _d[0], setSearchQuery = _d[1];
    (0, react_1.useEffect)(function () {
        if (step === 'loader') {
            var timer_1 = setTimeout(function () {
                navigation.navigate('MainTabs');
            }, 2000);
            return function () { return clearTimeout(timer_1); };
        }
    }, [step, navigation]);
    var searchResults = [
        { title: "Karaikal Beach", subtitle: "Karaikal, Puducherry" },
        { title: "Karaikal Bus Stand", subtitle: "Karaikal, Puducherry" },
        { title: "Karaikal Railway Station (KIK)", subtitle: "Karaikal, Puducherry, India" },
        { title: "Karaikal Ammaiyar Temple", subtitle: "Bharathiyar Street, Karaikal, Puducherry" }
    ].filter(function (item) {
        return !searchQuery ||
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    });
    return (<react_native_1.SafeAreaView style={styles.container}>
      {step === 'request' && (<react_native_1.View style={styles.requestContainer}>
          <react_native_1.View style={styles.topTextContent}>
            <react_native_1.Text style={styles.titleText}>
              What is <react_native_1.Text style={{ position: 'relative' }}>
                your
                <react_native_1.View style={{ position: 'absolute', bottom: -5, left: 0, right: 0 }}>
                  <react_native_svg_1.default viewBox="0 0 50 10" width="100%" height={10} preserveAspectRatio="none">
                    <react_native_svg_1.Path d="M1 9C15 1.5 35 1.5 49 9" stroke="#3D8CF2" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  </react_native_svg_1.default>
                </react_native_1.View>
              </react_native_1.Text> location?
            </react_native_1.Text>
            <react_native_1.Text style={styles.subtitleText}>We need your location to show available restaurants & products</react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View style={styles.graphicContainer}>
            <react_native_1.Image source={location_access_page_png_1.default} style={styles.graphicImage} resizeMode="contain"/>
          </react_native_1.View>

          <react_native_1.View style={styles.bottomCTAs}>
            <react_native_1.TouchableOpacity style={styles.allowBtn} activeOpacity={0.8} onPress={function () {
                setSelectedLocation("Sunnambukkara Street, Karaikal");
                setStep('loader');
            }}>
              <react_native_1.Text style={styles.allowBtnText}>ALLOW LOCATION ACCESS</react_native_1.Text>
            </react_native_1.TouchableOpacity>

            <react_native_1.TouchableOpacity style={styles.manualBtn} activeOpacity={0.7} onPress={function () { return setStep('manual'); }}>
              <react_native_1.Text style={styles.manualBtnText}>Enter Location Manually</react_native_1.Text>
              <lucide_react_native_1.ChevronRight size={14} color="#1e293b"/>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.View>)}

      {step === 'manual' && (<react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.manualContainer}>
          <react_native_1.View style={styles.manualHeader}>
            <react_native_1.TouchableOpacity style={styles.backBtn} onPress={function () { return setStep('request'); }}>
              <lucide_react_native_1.ChevronLeft size={20} color="#334155"/>
            </react_native_1.TouchableOpacity>
            <react_native_1.Text style={styles.manualHeaderTitle}>Enter your area or apartment name</react_native_1.Text>
          </react_native_1.View>

          <react_native_1.View style={styles.searchSection}>
            <react_native_1.View style={styles.searchInputContainer}>
              <lucide_react_native_1.Search size={16} color="#94a3b8" style={styles.searchIcon}/>
              <react_native_1.TextInput style={styles.searchInput} placeholder="Try Golden Nagar, Church Street, etc." placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery}/>
              {searchQuery.length > 0 && (<react_native_1.TouchableOpacity style={styles.clearBtn} onPress={function () { return setSearchQuery(''); }}>
                  <lucide_react_native_1.X size={10} color="#64748b"/>
                </react_native_1.TouchableOpacity>)}
            </react_native_1.View>

            <react_native_1.TouchableOpacity style={styles.currentLocationBtn} onPress={function () {
                setSelectedLocation("Sunnambukkara Street, Karaikal");
                setStep('loader');
            }}>
              <react_native_1.View style={styles.currentLocationLeft}>
                <react_native_1.View style={styles.currentLocationIconBg}>
                  <lucide_react_native_1.Navigation size={14} color="#3D8CF2" style={{ transform: [{ rotate: '135deg' }] }}/>
                </react_native_1.View>
                <react_native_1.Text style={styles.currentLocationText}>Use my current location</react_native_1.Text>
              </react_native_1.View>
              <lucide_react_native_1.ChevronRight size={14} color="#3D8CF2"/>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>

          <react_native_1.View style={styles.separator}/>

          <react_native_1.ScrollView style={styles.resultsList}>
            <react_native_1.Text style={styles.resultsHeader}>SEARCH RESULTS</react_native_1.Text>
            {searchResults.length > 0 ? (searchResults.map(function (item, idx) { return (<react_native_1.TouchableOpacity key={idx} style={styles.resultItem} onPress={function () {
                    setSelectedLocation("".concat(item.title, ", ").concat(item.subtitle.split(',')[0]));
                    setStep('loader');
                }}>
                  <react_native_1.View style={styles.resultIconBg}>
                    <lucide_react_native_1.Navigation size={13} color="#94a3b8" style={{ transform: [{ rotate: '135deg' }] }}/>
                  </react_native_1.View>
                  <react_native_1.View style={styles.resultTextContainer}>
                    <react_native_1.Text style={styles.resultTitle}>{item.title}</react_native_1.Text>
                    <react_native_1.Text style={styles.resultSubtitle}>{item.subtitle}</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.TouchableOpacity>); })) : (<react_native_1.View style={styles.noResultsContainer}>
                <react_native_1.Text style={styles.noResultsText}>No locations found matching your search</react_native_1.Text>
                <react_native_1.TouchableOpacity style={styles.useAnywayBtn} onPress={function () {
                    setSelectedLocation("".concat(searchQuery, ", Karaikal"));
                    setStep('loader');
                }}>
                  <react_native_1.Text style={styles.useAnywayText}>USE "{searchQuery}" ANYWAY</react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>)}
          </react_native_1.ScrollView>
        </react_native_1.KeyboardAvoidingView>)}

      {step === 'loader' && (<react_native_1.View style={styles.loaderContainer}>
          <react_native_1.Image source={{ uri: MAP_LOADING_GIF_URL }} style={styles.loaderGif} resizeMode="cover"/>
          <react_native_1.View style={styles.loaderOverlay}/>
          
          <react_native_1.View style={styles.loaderCard}>
            <react_native_1.View style={styles.loaderIconWrapper}>
              <lucide_react_native_1.Navigation size={16} color="#3D8CF2" style={{ transform: [{ rotate: '135deg' }] }}/>
            </react_native_1.View>
            <react_native_1.Text style={styles.loaderTitle}>Setting your location</react_native_1.Text>
            <react_native_1.Text style={styles.loaderSubtitle} numberOfLines={1} ellipsizeMode="tail">{selectedLocation}</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>)}
    </react_native_1.SafeAreaView>);
}
var styles = react_native_1.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    requestContainer: { flex: 1, backgroundColor: '#FAF7FF', padding: 24, justifyContent: 'space-between', alignItems: 'center' },
    topTextContent: { alignItems: 'center', paddingTop: 16, zIndex: 10 },
    titleText: { fontWeight: '900', color: '#0f172a', fontSize: 24, textAlign: 'center', letterSpacing: -0.5, marginTop: 16 },
    subtitleText: { fontSize: 11, color: '#64748b', fontWeight: '600', textAlign: 'center', maxWidth: 260, marginTop: 14, lineHeight: 18 },
    graphicContainer: { flex: 1, width: '100%', maxWidth: 340, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
    graphicImage: { width: '100%', height: '100%' },
    bottomCTAs: { width: '100%', paddingBottom: 24, zIndex: 10 },
    allowBtn: { width: '100%', height: 44, borderRadius: 12, backgroundColor: '#7CE045', alignItems: 'center', justifyContent: 'center', shadowColor: '#7CE045', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 6 },
    allowBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    manualBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
    manualBtnText: { fontSize: 11, fontWeight: '900', color: '#1e293b' },
    manualContainer: { flex: 1, backgroundColor: '#ffffff' },
    manualHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', gap: 12 },
    backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    manualHeaderTitle: { fontWeight: '900', fontSize: 14, color: '#0f172a' },
    searchSection: { padding: 16 },
    searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, height: 44, paddingHorizontal: 14 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 12, fontWeight: '600', color: '#0f172a' },
    clearBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
    currentLocationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, marginTop: 8 },
    currentLocationLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    currentLocationIconBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
    currentLocationText: { fontSize: 12, fontWeight: '900', color: '#3D8CF2' },
    separator: { height: 8, backgroundColor: '#f8fafc', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    resultsList: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    resultsHeader: { fontSize: 10, letterSpacing: 1, color: '#94a3b8', fontWeight: '700', marginBottom: 12, paddingHorizontal: 4 },
    resultItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12 },
    resultIconBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    resultTextContainer: { flex: 1 },
    resultTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 2 },
    resultSubtitle: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
    noResultsContainer: { alignItems: 'center', paddingVertical: 32 },
    noResultsText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
    useAnywayBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#3D8CF2', borderRadius: 8 },
    useAnywayText: { fontSize: 10, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
    loaderContainer: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    loaderGif: { position: 'absolute', width: '100%', height: '100%', opacity: 0.3 },
    loaderOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.4)' },
    loaderCard: { width: 240, backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 15, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)' },
    loaderIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    loaderTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
    loaderSubtitle: { fontSize: 11, fontWeight: '700', color: '#64748b' },
});
