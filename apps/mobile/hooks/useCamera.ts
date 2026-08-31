import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import type { ParseResult } from '@lifolio/shared-types';

export function useCamera() {
  const captureAndAnalyze = async (hint: 'receipt' | 'product' | 'auto' = 'auto'): Promise<ParseResult | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: false,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    formData.append('hint', hint);

    return api.analyzeImage(formData as unknown as File);
  };

  const pickAndAnalyze = async (hint: 'receipt' | 'product' | 'auto' = 'auto'): Promise<ParseResult | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
    formData.append('hint', hint);

    return api.analyzeImage(formData as unknown as File);
  };

  return { captureAndAnalyze, pickAndAnalyze };
}
