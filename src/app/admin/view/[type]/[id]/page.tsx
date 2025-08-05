// src/app/admin/all-posts/[type]/[id]/page.tsx
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Comment 인터페이스
interface Comment {
  id: number;
  content: string;
  created_at: string;
  author: { name: string; } | null;
  parent_comment_id: number | null;
  replies?: Comment[];
}

// PostDetails 인터페이스
interface PostDetails {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author: { name: string; } | null;
  comments: Comment[];
  image_urls?: string[];
  link_url?: string | null;
}

const TYPE_TO_KOREAN: { [key: string]: string } = {
  'notices': '공지사항',
  'arrest-news': '검거소식',
  'reviews': '후기',
  'incident-photos': '사건 사진자료',
  'new-crime-cases': '신종범죄 사례',
  'posts': '커뮤니티 글',
  'community_posts': '커뮤니티 글',
};

// 재귀 댓글 컴포넌트
const CommentItem = ({ comment, boardType, postId, onDelete, onReply, replyingToId, onActionSuccess }: {
  comment: Comment;
  boardType: string;
  postId: number;
  onDelete: (commentId: number) => void;
  onReply: (commentId: number | null) => void;
  replyingToId: number | null;
  onActionSuccess: () => void;
}) => {
  const [showActions, setShowActions] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReplying = replyingToId === comment.id;

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) {
      alert('대댓글 내용을 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          boardType,
          content: replyContent,
          parent_comment_id: comment.id,
        }),
      });
      if (!response.ok) throw new Error('대댓글 작성에 실패했습니다.');

      alert('대댓글이 작성되었습니다.');
      setReplyContent('');
      onReply(null);
      onActionSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`p-4 border rounded-md ${comment.parent_comment_id ? 'ml-6 bg-gray-50 border-gray-200' : 'bg-white border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="relative inline-block">
            <button onClick={() => setShowActions(!showActions)} className="font-semibold text-gray-800 text-left hover:text-indigo-600 focus:outline-none">
              {comment.author?.name || '익명'}
            </button>
            {showActions && (
              <div className="absolute top-full left-0 mt-2 w-32 bg-white border rounded-md shadow-lg z-10">
                {!comment.parent_comment_id && (
                  <button onClick={() => { onReply(comment.id); setShowActions(false); }} className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100">
                    대댓글 달기
                  </button>
                )}
                <button onClick={() => { onDelete(comment.id); setShowActions(false); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
                  삭제하기
                </button>
              </div>
            )}
          </div>
          <p className="text-gray-600 my-1">{comment.content}</p>
          <p className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</p>
        </div>
      </div>

      {isReplying && (
        <div className="mt-4 flex gap-2">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full text-sm border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={2}
            placeholder={`${comment.author?.name || '익명'}님에게 대댓글 남기기...`}
            disabled={isSubmitting}
            autoFocus
          />
          <button onClick={handleReplySubmit} disabled={isSubmitting} className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 flex-shrink-0 disabled:opacity-50">
            {isSubmitting ? '등록중...' : '등록'}
          </button>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
              onActionSuccess={onActionSuccess}
              boardType={boardType}
              postId={postId}
              onReply={onReply}
              replyingToId={replyingToId}
            />
          ))}
        </div>
      )}
    </div>
  );
};


export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;
  const id = params.id as string;

  const [post, setPost] = useState<PostDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);

  const fetchPostDetails = useCallback(async () => {
    if (!post) setLoading(true);
    try {
      const apiType = type === 'posts' ? 'community_posts' : type;
      const response = await fetch(`/api/admin/all-posts/${apiType}/${id}`);
      if (!response.ok) throw new Error('게시물 정보를 불러오는 데 실패했습니다.');
      const data = await response.json();
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류 발생');
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    if (type && id) {
      fetchPostDetails();
    }
  }, [type, id, fetchPostDetails]);

  // [수정됨] getEditLink 함수를 다시 추가합니다.
  const getEditLink = () => {
    const typeForEdit = type === 'community_posts' ? 'posts' : type;
    return `/admin/${typeForEdit}/${id}/edit`;
  };

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('정말로 이 댓글을 삭제하시겠습니까? 대댓글도 함께 삭제됩니다.')) {
      try {
        const response = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('댓글 삭제에 실패했습니다.');
        await fetchPostDetails();
        alert('댓글이 삭제되었습니다.');
      } catch (err) {
        alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
      }
    }
  };

  const nestedComments = useMemo(() => {
    if (!post?.comments) return [];
    const commentsById: { [key: number]: Comment } = {};
    const topLevelComments: Comment[] = [];

    post.comments.forEach(comment => {
      comment.replies = [];
      commentsById[comment.id] = comment;
    });

    post.comments.forEach(comment => {
      if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
        commentsById[comment.parent_comment_id].replies?.push(comment);
      } else {
        topLevelComments.push(comment);
      }
    });
    return topLevelComments;
  }, [post?.comments]);

  if (loading) return <div className="text-center p-8">로딩 중...</div>;
  if (error) return <div className="text-center text-red-500 p-8">오류: {error}</div>;
  if (!post) return <div className="text-center p-8">게시물을 찾을 수 없습니다.</div>;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <button onClick={() => router.back()} className="text-indigo-600 hover:underline">
            &larr; 목록으로 돌아가기
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{post.title}</h1>
          <div className="text-sm text-gray-500 mt-1">
            <span>게시판: {TYPE_TO_KOREAN[type] || type}</span>
            <span className="mx-2">|</span>
            <span>작성자: {post.author?.name || '정보 없음'}</span>
            <span className="mx-2">|</span>
            <span>작성일: {new Date(post.created_at).toLocaleString()}</span>
          </div>
        </div>
        <Link href={getEditLink()} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          수정하기
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="prose max-w-none text-gray-800 whitespace-pre-wrap mb-6">
          {post.content}
        </div>
        {post.link_url && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">관련 링크</h3>
            <a href={post.link_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{post.link_url}</a>
          </div>
        )}
        {post.image_urls && post.image_urls.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">첨부 이미지</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {post.image_urls.map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`첨부 이미지 ${index + 1}`} className="w-full h-auto object-cover rounded-lg shadow-md hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">댓글 ({post.comments.length}개)</h2>
        <div className="space-y-4">
          {nestedComments.length > 0 ? (
            nestedComments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onDelete={handleDeleteComment}
                boardType={type === 'posts' ? 'community_posts' : type}
                postId={post.id}
                onActionSuccess={fetchPostDetails}
                onReply={setReplyingToId}
                replyingToId={replyingToId}
              />
            ))
          ) : (
            <p className="text-gray-500">작성된 댓글이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
