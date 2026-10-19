Pod::Spec.new do |s|
  s.name         = 'FaazioGeocoder'
  s.version      = '1.0.0'
  s.summary      = 'On-device reverse geocoding for Faazio.'
  s.homepage     = 'https://faazio.com'
  s.license      = { :type => 'MIT' }
  s.author       = { 'Faazio' => 'engineering@faazio.com' }
  s.source       = { :path => '.' }
  s.source_files = '*.{swift,h,m}'
  s.platforms    = { :ios => '15.1' }
  s.swift_version = '5.0'
  s.dependency 'React-Core'
end
