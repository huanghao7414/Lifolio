import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { api } from '@/lib/api';
import type { ParseResult } from '@lifolio/shared-types';

export function useCamera() {
  const captureAndAnalyze = async (hint: 'receipt' | 'product' | 'auto' = 'auto'): Promise<ParseResult | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相机权限', '请在系统设置中允许 Lifolio 使用相机，以便识别小票或物品。');
      return null;
    }

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

    return api.analyzeImage(formData);
  };

  const pickAndAnalyze = async (hint: 'receipt' | 'product' | 'auto' = 'auto'): Promise<ParseResult | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要照片权限', '请在系统设置中允许 Lifolio 访问照片，以便识别小票或物品。');
      return null;
    }

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

    return api.analyzeImage(formData);
  };

  return { captureAndAnalyze, pickAndAnalyze };
}
