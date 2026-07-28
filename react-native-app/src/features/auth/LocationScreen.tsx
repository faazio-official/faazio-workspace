import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  ScrollView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ChevronLeft, ChevronRight, Navigation as NavigationIcon, Search, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import locationAccessPageImg from '../../assets/location_access_page.png';

type Props = NativeStackScreenProps<RootStackParamList, 'Location'>;

const MAP_LOADING_GIF_URL = "https://i.pinimg.com/originals/f3/f9/ce/f3f9ce3dfdb88b90f4e3c5ec7bc5dc85.gif";

export function LocationScreen({ navigation }: Props) {
  const [step, setStep] = useState<'request' | 'manual' | 'loader'>('request');
  const [selectedLocation, setSelectedLocation] = useState('Sunnambukkara Street, Karaikal');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (step === 'loader') {
      const timer = setTimeout(() => {
        navigation.navigate('MainTabs');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, navigation]);

  const searchResults = [
    { title: "Karaikal Beach", subtitle: "Karaikal, Puducherry" },
    { title: "Karaikal Bus Stand", subtitle: "Karaikal, Puducherry" },
    { title: "Karaikal Railway Station (KIK)", subtitle: "Karaikal, Puducherry, India" },
    { title: "Karaikal Ammaiyar Temple", subtitle: "Bharathiyar Street, Karaikal, Puducherry" }
  ].filter(item => 
    !searchQuery || 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {step === 'request' && (
        <View style={styles.requestContainer}>
          <View style={styles.topTextContent}>
            <Text style={styles.titleText}>
              What is <Text style={{ position: 'relative' }}>
                your
                <View style={{ position: 'absolute', bottom: -5, left: 0, right: 0 }}>
                  <Svg viewBox="0 0 50 10" width="100%" height={10} preserveAspectRatio="none">
                    <Path d="M1 9C15 1.5 35 1.5 49 9" stroke="#3D8CF2" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  </Svg>
                </View>
              </Text> location?
            </Text>
            <Text style={styles.subtitleText}>We need your location to show available restaurants & products</Text>
          </View>

          <View style={styles.graphicContainer}>
            <Image source={locationAccessPageImg} style={styles.graphicImage} resizeMode="contain" />
          </View>

          <View style={styles.bottomCTAs}>
            <TouchableOpacity 
              style={styles.allowBtn} 
              activeOpacity={0.8}
              onPress={() => {
                setSelectedLocation("Sunnambukkara Street, Karaikal");
                setStep('loader');
              }}
            >
              <Text style={styles.allowBtnText}>ALLOW LOCATION ACCESS</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.manualBtn} 
              activeOpacity={0.7}
              onPress={() => setStep('manual')}
            >
              <Text style={styles.manualBtnText}>Enter Location Manually</Text>
              <ChevronRight size={14} color="#1e293b" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'manual' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.manualContainer}>
          <View style={styles.manualHeader}>
            <TouchableOpacity 
              style={styles.backBtn}
              onPress={() => setStep('request')}
            >
              <ChevronLeft size={20} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.manualHeaderTitle}>Enter your area or apartment name</Text>
          </View>

          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Search size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Try Golden Nagar, Church Street, etc."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
                  <X size={10} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={styles.currentLocationBtn}
              onPress={() => {
                setSelectedLocation("Sunnambukkara Street, Karaikal");
                setStep('loader');
              }}
            >
              <View style={styles.currentLocationLeft}>
                <View style={styles.currentLocationIconBg}>
                  <NavigationIcon size={14} color="#3D8CF2" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
                <Text style={styles.currentLocationText}>Use my current location</Text>
              </View>
              <ChevronRight size={14} color="#3D8CF2" />
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />

          <ScrollView style={styles.resultsList}>
            <Text style={styles.resultsHeader}>SEARCH RESULTS</Text>
            {searchResults.length > 0 ? (
              searchResults.map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.resultItem}
                  onPress={() => {
                    setSelectedLocation(`${item.title}, ${item.subtitle.split(',')[0]}`);
                    setStep('loader');
                  }}
                >
                  <View style={styles.resultIconBg}>
                    <NavigationIcon size={13} color="#94a3b8" style={{ transform: [{ rotate: '135deg' }] }} />
                  </View>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle}>{item.title}</Text>
                    <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No locations found matching your search</Text>
                <TouchableOpacity 
                  style={styles.useAnywayBtn}
                  onPress={() => {
                    setSelectedLocation(`${searchQuery}, Karaikal`);
                    setStep('loader');
                  }}
                >
                  <Text style={styles.useAnywayText}>USE "{searchQuery}" ANYWAY</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {step === 'loader' && (
        <View style={styles.loaderContainer}>
          <Image source={{ uri: MAP_LOADING_GIF_URL }} style={styles.loaderGif} resizeMode="cover" />
          <View style={styles.loaderOverlay} />
          
          <View style={styles.loaderCard}>
            <View style={styles.loaderIconWrapper}>
              <NavigationIcon size={16} color="#3D8CF2" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <Text style={styles.loaderTitle}>Setting your location</Text>
            <Text style={styles.loaderSubtitle} numberOfLines={1} ellipsizeMode="tail">{selectedLocation}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
