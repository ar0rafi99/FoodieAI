export type MenuItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  emoji: string;
  description: string;
};

export const categories = ["সব", "ভাত", "ফাস্ট ফুড", "ড্রিংকস", "ডেজার্ট"];

export const menuItems: MenuItem[] = [
  { id: 1, name: "কাচ্চি বিরিয়ানি", category: "ভাত", price: 320, emoji: "🍛", description: "খাসির মাংস ও সুগন্ধি চালের ঐতিহ্যবাহী কাচ্চি" },
  { id: 2, name: "বিফ তেহারি", category: "ভাত", price: 220, emoji: "🍚", description: "ঝাল ঝাল বিফ তেহারি, সাথে বোরহানি" },
  { id: 3, name: "চিকেন ফ্রাইড রাইস", category: "ভাত", price: 180, emoji: "🍳", description: "সবজি ও চিকেন দিয়ে ফ্রাইড রাইস" },
  { id: 4, name: "চিকেন বার্গার", category: "ফাস্ট ফুড", price: 190, emoji: "🍔", description: "ক্রিস্পি চিকেন প্যাটি, চিজ ও সস" },
  { id: 5, name: "পেপারনি পিৎজা", category: "ফাস্ট ফুড", price: 550, emoji: "🍕", description: "৮ ইঞ্চি, এক্সট্রা চিজ" },
  { id: 6, name: "ফুচকা", category: "ফাস্ট ফুড", price: 80, emoji: "🥟", description: "টক-ঝাল ফুচকা, ৬ পিস" },
  { id: 7, name: "ফ্রেঞ্চ ফ্রাইজ", category: "ফাস্ট ফুড", price: 120, emoji: "🍟", description: "মচমচে ফ্রাইজ, মশলা সহ" },
  { id: 8, name: "মিষ্টি লাচ্ছি", category: "ড্রিংকস", price: 90, emoji: "🥛", description: "ঘন দইয়ের ঠান্ডা লাচ্ছি" },
  { id: 9, name: "কোল্ড কফি", category: "ড্রিংকস", price: 140, emoji: "🧋", description: "আইসক্রিম সহ ঠান্ডা কফি" },
  { id: 10, name: "লেবু শরবত", category: "ড্রিংকস", price: 50, emoji: "🍋", description: "তাজা লেবুর শরবত" },
  { id: 11, name: "ফিরনি", category: "ডেজার্ট", price: 70, emoji: "🍮", description: "দুধ ও চালের মিষ্টি ফিরনি" },
  { id: 12, name: "রসমালাই", category: "ডেজার্ট", price: 100, emoji: "🍨", description: "২ পিস রসমালাই" },
];